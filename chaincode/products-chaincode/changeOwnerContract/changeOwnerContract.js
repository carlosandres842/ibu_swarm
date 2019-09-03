'use strict';
const { Contract } = require('fabric-contract-api');
const walletsContract = require('./../walletsContract/walletsContract')
const sha256 = require('sha256')
const CryptoJS = require("crypto-js");
const NodeRSA = require('node-rsa');



class ChangeOwnerContract extends Contract {


    constructor() {
        // Unique namespace when multiple contracts per chaincode file
        super('changeOwnerContract');
    }


    async upgrade(ctx) {
    }

    

    async changeOwner(ctx, id, pubECDSA, privECDSA, newPubECDSA) {

        //Check if product exist
        const productkey = ('Product' + id);
        const productAsBytes = await ctx.stub.getState(productkey);

        if (!productAsBytes || productAsBytes.length === 0) {
            throw new Error(`Product ${key} not found`);
        }

        //Check if owner wallet exist
        const ownerWalletKey = ('Wallet' +pubECDSA);
        const ownerWalletAsBytes = await ctx.stub.getState(ownerWalletKey);

        if (!ownerWalletAsBytes || ownerWalletAsBytes.length === 0) {
            throw new Error(`Wallet ${pubECDSA} not found`);
        }

        //Check if new owner wallet exist
        const newOwnerWalletKey = ('Wallet' + newPubECDSA);
        const newOwnerWalletAsBytes = await ctx.stub.getState(newOwnerWalletKey);

        if (!newOwnerWalletAsBytes || newOwnerWalletAsBytes.length === 0) {
            throw new Error(`Wallet ${newPubECDSA} not found`);
        }

        //get owner keys
        let ownerKeys_Key = `key_${pubECDSA}`
        const ownerKeysAsBytes = await ctx.stub.getState(ownerKeys_Key);
        if (!ownerKeysAsBytes || ownerKeysAsBytes.length === 0) {
            throw new Error(`Keys not found`);
        }

        let ownerKeys =JSON.parse(ownerKeysAsBytes.toString());

        let privECDSA_Sing = sha256(privECDSA)

        //Object to handle RSA keys
        const keyRSA_Object = new NodeRSA();

        //decrypt keys
        let bytes = CryptoJS.AES.decrypt(ownerKeys.cypherPrivRSA.toString(), privECDSA_Sing);
        let privRSA =  bytes.toString(CryptoJS.enc.Utf8);

        //set keys
        ownerKeys.pubRSA.n = Buffer.from(ownerKeys.pubRSA.n)
        keyRSA_Object.importKey(ownerKeys.pubRSA,'components-public')
        keyRSA_Object.importKey(privRSA)

        let objectOwner = keyRSA_Object.decrypt(Buffer.from(ownerKeys.owner), 'utf8')

        
        //Set new pubkey to product
        
        let product = JSON.parse(productAsBytes.toString());
        
        
        if (product.owner === objectOwner) {
            //Update ledger with product
            product.owner = newPubECDSA
            await ctx.stub.putState(productkey, Buffer.from(JSON.stringify(product)));

            //Push product in new owner wallet
            let newOwnerWallet = JSON.parse(newOwnerWalletAsBytes.toString());
	    let dataObject = JSON.parse(product.data);
            newOwnerWallet.assets.push({id:product.id,name:dataObject.name});
            await ctx.stub.putState(newOwnerWalletKey, Buffer.from(JSON.stringify(newOwnerWallet)));

            //Delete product in owner wallet
            let ownerWallet = JSON.parse(ownerWalletAsBytes.toString());
            let i = 0;
            while (ownerWallet.assets[i].id != product.id) {
                i = i + 1;
            }
            ownerWallet.assets.splice(i, 1);
            await ctx.stub.putState(ownerWalletKey, Buffer.from(JSON.stringify(ownerWallet)));

            return product;
        }
        else {
            throw new Error(`The product ${id} does not belong to the wallet ${pubECDSA}`);
        }


    }

}
module.exports = ChangeOwnerContract;
