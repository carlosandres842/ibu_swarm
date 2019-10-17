const { Contract } = require('fabric-contract-api');
const EC = require('elliptic').ec;
const ecdsa = new EC('secp256k1');
const RIPEMD160 = require('ripemd160');
const Base58 = require('bs58');
const sha256 = require('js-sha256');
const bip39 = require('bip39')

class ProductsContract extends Contract {

    constructor() {
        // Unique namespace when multiple contracts per chaincode file
        super('ProductsContract');
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

    //construir WalletBS a partir de una clabe pubECDSA_hex
    buildWalletBS(pubECDSA_hex) {
        let hash = sha256(Buffer.from(pubECDSA_hex, 'hex'));
        let publicKeyHash = new RIPEMD160().update(Buffer.from(hash, 'hex')).digest();
        let bufferWallet = Buffer.from(publicKeyHash.toString('hex'), "hex");
        let walletBS = 'BS' + Base58.encode(bufferWallet);
        return walletBS;
    }

    convertDate(timestamp) {
        let unixtimestamp = timestamp;
        var months_arr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        var date = new Date(unixtimestamp * 1000);
        var year = date.getFullYear();
        var month = months_arr[date.getMonth()];
        var day = date.getDate();
        var hours = date.getHours();
        var minutes = "0" + date.getMinutes();
        var seconds = "0" + date.getSeconds();
        var convdataTime = month + '-' + day + '-' + year + ' ' + hours + ':' + minutes.substr(-2) + ':' + seconds.substr(-2) + ' [UTC]';
        return convdataTime;
    }

    async create(ctx, idOrg, walletBS, pubECDSA_hex, sign, msg, productData) {

        let response = {
          ok:true,
          responseTx:''
        }

        //Verificar walletBS a partir de pubECDSA_hex
        if (!this.verifyWallet(pubECDSA_hex, walletBS)) {
          response.ok = false;
          response.responseTx = `La wallet ${walletBS} no coincide con la clave pública$ ${pubECDSA_hex}`;
          return response;
        }

        //Verificar la firma sign
        if (!this.verifySign(pubECDSA_hex, msg, sign)) {
          response.ok = false;
          response.responseTx = `La firma ${sign} no coincide con la clave ${pubECDSA_hex}`;
          return response;
        }

        //Verificar org - isProductCreator
        let orgAsByte = await ctx.stub.getState('Org_' + idOrg);
        if (!orgAsByte || orgAsByte.length === 0) {
          response.ok = false;
          response.responseTx = `La organización ${idOrg}no se encuentra registrada`;
          return response;
        }

        let org = JSON.parse(orgAsByte.toString());
        if (org.wallet != walletBS) {
          response.ok = false;
          response.responseTx = `La organización ${idOrg} no coincide con la wallet ${walletBS}`;
          return response;
        }
        
        if (!JSON.parse(org.isProductCreator)) {
          response.ok = false;
          response.responseTx = `La organización ${idOrg} no puede crear productos`;
          return response;
        }

        //Crear producto
        let product = {
            id: Date.now(),
            owner: walletBS,
            data: JSON.parse(productData),
            type: 'Product'
        };
        await ctx.stub.putState('Product_' + product.id, Buffer.from(JSON.stringify(product)));

        //Setear producto en la walletBS
        let walletAsByte = await ctx.stub.getState('Wallet_' + walletBS);
        let wallet = JSON.parse(walletAsByte.toString());
        wallet.assets.push({ id: product.id, name: product.data.name });
        await ctx.stub.putState('Wallet_' + walletBS, Buffer.from(JSON.stringify(wallet)));

        response.responseTx = product;
        return response;

    }

    async transfer(ctx, walletBS ,idAsset, newOwner, pubECDSA_hex, sign, msg) {

        let response = {
          ok:true,
          responseTx:''
        }

        //Validar que la firma corresponda con la tx
        if(msg != sha256(idAsset + walletBS + newOwner)){
          response.ok = false;
          response.responseTx = `La firma no coincide con la transacción`;
          return response;
        }
        //Validar que las wallet existan
        let walletBSFromPubECDSA = this.buildWalletBS(pubECDSA_hex);
        let originWalletAsByte = await ctx.stub.getState('Wallet_' + walletBSFromPubECDSA);
        if (!originWalletAsByte || originWalletAsByte.length === 0) {
          response.ok = false;
          response.responseTx = `El producto con id ${walletBSFromPubECDSA} no existe`;
          return response;
        }
        let newOwnerAsByte = await ctx.stub.getState('Wallet_' + newOwner);
        if (!newOwnerAsByte || newOwnerAsByte.length === 0) {
          response.ok = false;
          response.responseTx = `La wallet ${newOwner} no existe`;
          return response;
        }

        // Obtener producto del Ledger
        let productAsByte = await ctx.stub.getState('Product_' + idAsset);
        if (!productAsByte || productAsByte.length === 0) {
          response.ok = false;
          response.responseTx = `El producto con id ${idAsset} no existe`;
          return response;
        }
        let product = JSON.parse(productAsByte.toString());

        //Construir wallet a partir de pubECDSA_Hex y verificar con product.owner

        if (!this.verifyWallet(pubECDSA_hex, product.owner)) {
          response.ok = false;
          response.responseTx = `El producto ${idAsset} no pertenece a la wallet ${walletBSFromPubECDSA}`;
          return response;
        }
        if (!this.verifySign(pubECDSA_hex, msg, sign)) {
          response.ok = false;
          response.responseTx = `La firma ${sign} no coincide con la clave ${pubECDSA_hex}`;
          return response;
        }

        //Comparar asset.owner vs walletBS ----> pubECDSA_hex
        if (walletBSFromPubECDSA != product.owner) {
          response.ok = false;
          response.responseTx = `El producto ${product.id} no pertenece a la Wallet ${walletBSFromPubECDSA}`;
          return response;
        }

        //Setear nuevo owner en producto e incluir al Ledger
        product.owner = newOwner;
        await ctx.stub.putState('Product_' + idAsset, Buffer.from(JSON.stringify(product)));

        //Eliminar producto en wallet origen
        let originWallet = JSON.parse(originWalletAsByte.toString());
        
        for (let i = 0; i < originWallet.assets.length; i++) {
            if (originWallet.assets[i].id == idAsset) {
              originWallet.assets.splice(i, 1);
                break;
            }
        }
        await ctx.stub.putState('Wallet_' + walletBSFromPubECDSA, Buffer.from(JSON.stringify(originWallet)));

        //Agregar producto a Wallet de newOwner
        let newOwnerWallet = JSON.parse(newOwnerAsByte.toString());
        newOwnerWallet.assets.push({ id: product.id, name: product.data.name });
        await ctx.stub.putState('Wallet_' + newOwner, Buffer.from(JSON.stringify(newOwnerWallet)));
        response.responseTx = product;
        return response;
    }

    async getHistory(ctx, idAsset) {
        let key = ('Product_' + idAsset);
        let iterator = await ctx.stub.getHistoryForKey(key);
        //Transform iterator to array of objects
        const allResults = [];
        let res = null;
        while (res == null || !res.done) {
            res = await iterator.next();
            if (res.value && res.value.value.toString()) {
                let parsedItem = {
                    is_delete: false,
                    value: {},
                    timestamp: null,
                    tx_id: ''
                };
                try {
                    parsedItem.value = JSON.parse(res.value.value.toString('utf8'));
                } catch (err) {
                    parsedItem.value = res.value.value.toString('utf8');
                }
                parsedItem.is_delete = res.value.is_delete;
                parsedItem.tx_id = res.value.tx_id;
                parsedItem.timestamp = this.convertDate(res.value.timestamp.getSeconds());
                allResults.push(parsedItem);
            }
        }
        await iterator.close();
        return allResults;
    }

    async getProductDetail(ctx, idAsset) {
        let response = {
          ok:true,
          responseTx:''
        }

        let key = ('Product_' + idAsset);
        //Transform iterator to array of objects

        let productAsBytes = await ctx.stub.getState(key);

        if (!productAsBytes || productAsBytes.length === 0) {
          response.ok = false;
          response.responseTx = `Product ${idAsset} not found`;
          return response;
        }
        const product = JSON.parse(productAsBytes.toString());

        const history = await this.getHistory(ctx, idAsset);

        let productHistory = {
            product,
            history
        };

        response.responseTx = productHistory;
        return response;
    }
}

module.exports = ProductsContract
