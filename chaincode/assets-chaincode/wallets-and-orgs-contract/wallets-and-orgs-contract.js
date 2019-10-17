const { Contract } = require('fabric-contract-api');
const EC = require('elliptic').ec;
const ecdsa = new EC('secp256k1');
const RIPEMD160 = require('ripemd160');
const Base58 = require('bs58');
const sha256 = require('js-sha256');
const bip39 = require('bip39')


class WalletsAndOrgsContract extends Contract {

  constructor() {
    // Unique namespace when multiple contracts per chaincode file
    super('WalletsAndOrgsContract');
  }

  async upgrade(ctx) {

  }

  async orgGenesis(ctx, walletBS, pubECDSA_hex, sign, msg) {

    //Verificar que blocksaas no exista
    const iterator = await ctx.stub.getStateByRange('Wallet_', '');
    const res = await iterator.next();
    if (res.value != null) {

      throw new Error(`La organizacion BlockSaaS ya fue creada`);
    } else {

      //Verificar walletBS a partir de pubECDSA_hex
      if (!this.verifyWallet(pubECDSA_hex, walletBS)) {
        throw new Error(`La wallet ${walletBS}no coincide con la clave ${pubECDSA_hex}`);
      } else if (!this.verifySign(pubECDSA_hex, msg, sign)) { //Verificar la firma sign
        throw new Error(`La firma ${sign} no coincide con la clave ${pubECDSA_hex}`);
      } else {

        //Registrar el asset Org de BlockSaaS
        let orgBlockSaaSObject = {
          id: Date.now(),
          name: 'BlockSaaS',
          owner: walletBS,  //BlockSaaS es el mismo propietario
          wallet: walletBS, //la wallet de BlockSaaS
          isOrgCreator: true,
          isProductCreator: true,
          type: 'Org'
        };
        let orgKey = 'Org_' + orgBlockSaaSObject.id;
        await ctx.stub.putState(orgKey, Buffer.from(JSON.stringify(orgBlockSaaSObject)));


        //Registrar la wallet de BlockSaaS en el ledger
        let walletKey = 'Wallet_' + walletBS;
        let walletObject = {
          orgs: [],
          assets: [],
          owner: walletBS,
          idOrg: orgBlockSaaSObject.id,
          type: 'Wallet'
        }
        await ctx.stub.putState(walletKey, Buffer.from(JSON.stringify(walletObject)));
      }
    }

  }

  verifyWallet(pubECDSA_hex, walletBS) {
    let verifyWalletBS = this.buildWalletBS(pubECDSA_hex);
    let isEquals = true;
    if (verifyWalletBS != walletBS) {
      isEquals = false;
    }
    return isEquals;
  }

  verifySign(pubECDSA_hex, msg, sign) {
    const publicKeyPair = ecdsa.keyFromPublic(pubECDSA_hex, 'hex');
    const isVerified = publicKeyPair.verify(msg, JSON.parse(sign));
    return isVerified;
  }

  buildWalletBS(pubECDSA_hex) {
    let hash = sha256(Buffer.from(pubECDSA_hex, 'hex'));
    let publicKeyHash = new RIPEMD160().update(Buffer.from(hash, 'hex')).digest();
    let bufferWallet = Buffer.from(publicKeyHash.toString('hex'), "hex");
    let walletBS = 'BS' + Base58.encode(bufferWallet);
    return walletBS;
  }

  async createOrg(ctx, orgName, walletBS, pubECDSA_hex, sign, msg, isProductCreator, isOrgCreator) {

    let response = {
      ok: true,
      responseTx: ''
    }

    //Verificar walletBS a partir de pubECDSA_hex
    if (!this.verifyWallet(pubECDSA_hex, walletBS)) {
      response.ok = false;
      response.responseTx = `La wallet ${walletBS} no coincide con la clave pública$ ${pubECDSA_hex}`;
      return response;
    } else {
      if (!this.verifySign(pubECDSA_hex, msg, sign)) {
        response.ok = false;
        response.responseTx = `La firma ${sign} no coincide con la clave pública ${pubECDSA_hex}`;
        return response;
      } else {

        //Obtener Wallet del padre
        let sugarDaddyWalletAsByte = await ctx.stub.getState('Wallet_' + walletBS);
        if (!sugarDaddyWalletAsByte || sugarDaddyWalletAsByte.length === 0) {
          response.ok = false;
          response.responseTx = `Wallet ${walletBS} no existe`;
          return response;
        }
        let sugarDaddyWallet = JSON.parse(sugarDaddyWalletAsByte.toString());

        //Obtener org del padre para verificar isOrgCreator

        let sugarDaddyOrgAsByte = await ctx.stub.getState('Org_' + sugarDaddyWallet.idOrg);
        if (!sugarDaddyOrgAsByte || sugarDaddyOrgAsByte.length === 0) {
          response.ok = false;
          response.responseTx = `No se encontró una organización asociada a la wallet: ${walletBS}`;
          return response;
        }
        let sugarDaddyOrg = JSON.parse(sugarDaddyOrgAsByte.toString());

        if (!JSON.parse(sugarDaddyOrg.isOrgCreator)) {
          response.ok = false;
          response.responseTx = `La organización ${sugarDaddyWallet.idOrg} no puede crear Organizaciones`;
          return response;
        }

        //Crear código de verificacion
        let code = Date.now() + walletBS.substring(walletBS.length - 5, walletBS.length - 1);

        //Crear asset tipo Org_
        let orgObject = {
          id: Date.now(),
          name: orgName,
          owner: walletBS,
          wallet: '', //Inicialmente queda vacía debido a que no se ha creado la wallet
          isProductCreator,
          isOrgCreator,
          code,
          type: 'Org'
        };
        let orgKey = 'Org_' + orgObject.id;
        await ctx.stub.putState(orgKey, Buffer.from(JSON.stringify(orgObject)));

        //Agregar a la wallet del padre
        sugarDaddyWallet.orgs.push({ id: orgObject.id, name: orgObject.name, code: orgObject.code });

        await ctx.stub.putState('Wallet_' + walletBS, Buffer.from(JSON.stringify(sugarDaddyWallet)))

        response.responseTx = orgObject;
        return response;
      }
    }
  }

  async createWallet(ctx, idOrg, code, walletBS, pubECDSA_hex, sign, msg, fatherWalletBS) {

    let response = {
      ok: true,
      responseTx: ''
    }

    //Verificar walletBS a partir de pubECDSA_hex
    if (!this.verifyWallet(pubECDSA_hex, walletBS)) {
      response.ok = false;
      response.responseTx = `La wallet ${walletBS} no coincide con la clave pública$ ${pubECDSA_hex}`;
      return response;
    }
    if (!this.verifySign(pubECDSA_hex, msg, sign)) { //Verificar la firma sign
      response.ok = false;
      response.responseTx = `La firma ${sign} no coincide con la clave pública ${pubECDSA_hex}`;
      return response;
    }

    let walletExist = await ctx.stub.getState('Wallet_' + walletBS);
    if (!walletExist || walletExist.length === 0) {

      //Verificar que exista wallet del padre
      let fatherWalletAsByte = await ctx.stub.getState(`Wallet_${fatherWalletBS}`)
      if (!fatherWalletAsByte || fatherWalletAsByte.length === 0) {
        response.ok = false;
        response.responseTx = `Wallet ${fatherWalletBS} no existe`;
        return response;
      }
      let fatherWalletObject = JSON.parse(fatherWalletAsByte.toString());

      //Verificar código en wallet del padre
      let fatherOrgs = fatherWalletObject.orgs;
      let orgExists = false;

      //Recorrer Array de organizaciones del padre para verificar el código
      for (let i = 0; i < fatherOrgs.length; i++) {

        if (fatherOrgs[i].id == idOrg) {
          if (fatherOrgs[i].code == code) {
            orgExists = true
            break;
          } else {
            response.ok = false;
            response.responseTx = `El código: ${code} no coincide con el código de la organización ${fatherOrgs[i].name}`;
            return response;
          }
        }
      }

      if (!orgExists) {
        response.ok = false;
        response.responseTx = `La organizacion no pertenece a la wallet del padre`;
        return response;
      }

      //Obtener org del ledger
      let orgAsByte = await ctx.stub.getState(`Org_${idOrg}`);
      if (!orgAsByte || orgAsByte.length === 0) {
        response.ok = false;
        response.responseTx = `La organización no se encuentra registrada`;
        return response;
      }
      let org = JSON.parse(orgAsByte.toString());

      //Verificar código de activación en org
      if (org.code != code) {
        response.ok = false;
        response.responseTx = `El código: ${code} no coincide con el código de la organización ${org.name}`;
        return response;
      }

      //Crear Wallet

      let walletObject = {
        orgs: [],
        assets: [],
        idOrg: idOrg,
        owner: fatherWalletBS,
        type: 'Wallet'
      }

      await ctx.stub.putState(`Wallet_${walletBS}`, Buffer.from(JSON.stringify(walletObject)));

      //Agregar la wallet en el objeto de tipo org
      org.wallet = walletBS;
      await ctx.stub.putState(`Org_${org.id}`, Buffer.from(JSON.stringify(org)));

      response.ok = true;
      response.responseTx = walletObject;
      return response;

    } else {
      response.ok = false;
      response.responseTx = `Wallet ${walletBS} ya existe`;
      return response
    }





  }

  async getBalance(ctx, walletBS, pubECDSA_hex, sign, msg) {

    let response = {
      ok: true,
      responseTx: ''
    }

    //Verificar walletBS a partir de pubECDSA_hex
    if (!this.verifyWallet(pubECDSA_hex, walletBS)) {
      response.ok = false;
      response.responseTx = `La wallet ${walletBS} no coincide con la clave pública$ ${pubECDSA_hex}`;
      return response;
    }
    if (!this.verifySign(pubECDSA_hex, msg, sign)) { //Verificar la firma sign
      response.ok = false;
      response.responseTx = `La firma ${sign} no coincide con la clave ${pubECDSA_hex}`;
      return response;
    }

    let walletKey = 'Wallet_' + walletBS;
    let walletAsByte = await ctx.stub.getState(walletKey);

    if (!walletAsByte || walletAsByte.length === 0) {
      response.ok = false;
      response.responseTx = `La wallet ${walletBS} no existe`;
      return response;
    }

    let wallet = JSON.parse(walletAsByte.toString());
    let balance = {
      assets: wallet.assets,
      orgs: wallet.orgs
    }
    response.responseTx = balance;
    return response;
  }

  async getOrg() {

  }

  async addOrg() {

  }

  async transferOrg(ctx, idOrg, walletBS, pubECDSA_hex, sign, msg, walletBS_newOwner) {

    let response = {
      ok: true,
      responseTx: ''
    }

    //Validar que la firma corresponda con la tx
    if (msg !== sha256(idOrg + walletBS + walletBS_newOwner)) {
      response.ok = false;
      response.responseTx = `La firma no coincide con la transacción`;
      return response;
    }
      //Verificar walletBS a partir de pubECDSA_hex
      if (!this.verifyWallet(pubECDSA_hex, walletBS)) {
        response.ok = false
        response.responseTx = `La wallet ${walletBS} no coincide con la clave ${pubECDSA_hex}`
        return response;
      }
      if (!this.verifySign(pubECDSA_hex, msg, sign)) { //Verificar la firma sign
        response.ok = false
        response.responseTx = `La firma ${sign} no coincide con la clave ${pubECDSA_hex}`
        return response;
      }

      let orgObjectAsByte = await ctx.stub.getState(`Org_${idOrg}`)


      if (!orgObjectAsByte || orgObjectAsByte.length === 0) {
        response.ok = false
        response.responseTx = `La organización ${idOrg} no existe`
        return response;
      }

      //Objeto que contiene el Asset de tipo Org a transferir
      let orgObject = JSON.parse(orgObjectAsByte.toString());

      let ownerWalletAsByte = await ctx.stub.getState(`Wallet_${walletBS}`)

      if (!ownerWalletAsByte || ownerWalletAsByte.length === 0) {
        response.ok = false
        response.responseTx = `La wallet ${walletBS} no existe`
        return response;
      }

      //Objeto que contiene la wallet del propietario
      let ownerWallet = JSON.parse(ownerWalletAsByte.toString());

      if (walletBS != orgObject.owner) {
        response.ok = false
        response.responseTx = `La organización ${idOrg} no pertenece a la wallet ${walletBS}`
        return response;
      }

      let newOwnerWalletAsByte = await ctx.stub.getState(`Wallet_${walletBS_newOwner}`)

      if (!newOwnerWalletAsByte || newOwnerWalletAsByte.length === 0) {
        response.ok = false
        response.responseTx = `La wallet ${walletBS_newOwner} no existe`
        return response;
      }

      //Objeto que contiene la wallet del nuevo propietario
      let newOwnerWallet = JSON.parse(newOwnerWalletAsByte.toString());

      //Agregar org al nuevo propietario
      newOwnerWallet.orgs.push({ id: orgObject.id, name: orgObject.name, code: orgObject.code });

      //Eliminar org del antiguo dueño
      for (let i = 0; i < ownerWallet.orgs.length; i++) {

        if (ownerWallet.orgs[i].id == idOrg) {
          ownerWallet.orgs.splice(i, 1);
          break;
        }
      }

      //modificar owner en asstet tipo ORG
      orgObject.owner = walletBS_newOwner;
      //Se restingen los permisos de creación de productos y organizaciones
      orgObject.isProductCreator = false;
      orgObject.isOrgCreator = false;

      //Obtener wallet de org a transferir en caso de que haya sido creada
      if (orgObject.wallet != "") {
        let walletAsBytes = await ctx.stub.getState(`Wallet_${orgObject.wallet}`)
        //Objeto que contiene el Asset de tipo Org a transferir
        let walletObject = JSON.parse(walletAsBytes.toString());
        //Actualizar owner
        walletObject.owner = walletBS_newOwner;
        //Actualizar en ledger
        await ctx.stub.putState(`Wallet_${orgObject.wallet}`, Buffer.from(JSON.stringify(walletObject)));
      }

      //Actualizar los estados en el ledger
      await ctx.stub.putState(`Org_${idOrg}`, Buffer.from(JSON.stringify(orgObject)));
      await ctx.stub.putState(`Wallet_${walletBS}`, Buffer.from(JSON.stringify(ownerWallet)));
      await ctx.stub.putState(`Wallet_${walletBS_newOwner}`, Buffer.from(JSON.stringify(newOwnerWallet)));

      response.ok = true
      response.responseTx = orgObject;
      return response;



    }

  }

module.exports = WalletsAndOrgsContract
