'use strict';
///////////////////////////////////////////////////////////
///////////////////  Imports   ///////////////////////////
//////////////////////////////////////////////////////////
const NodeRSA = require('node-rsa');
const CryptoJS = require("crypto-js");
const sha256 = require('sha256')
const { Contract } = require('fabric-contract-api');

class WalletsContract extends Contract {

    constructor() {
        // Unique namespace when multiple contracts per chaincode file
        super('walletsContract');
    }

    async init(ctx) {
       
    }

    async upgrade(ctx) {

    }

    async createWallet(ctx, pubECDSA) {
        const key = ('Wallet' + pubECDSA);
        const wallet = {
            pubKey: pubECDSA,
            assets:[]
        }
        await ctx.stub.putState(key, Buffer.from(JSON.stringify(wallet)));
        return 'Wallet create successful'
    }


    async getBalance(ctx, pubKey) {

        const key = ('Wallet' + pubKey);
        const walletAsBytes = await ctx.stub.getState(key);

        if (!walletAsBytes || walletAsBytes.length === 0) {
            return `Wallet not found`;
        }

        let wallet = JSON.parse(walletAsBytes.toString());
        return wallet.assets;

    }

    async walletExist(ctx,pubKey){

        const key = ('Wallet' + pubKey);
        const walletAsBytes = await ctx.stub.getState(key);

        if (!walletAsBytes || walletAsBytes.length === 0) {
            return false;
        }else{
            const wallet = JSON.parse(walletAsBytes.toString());
            if(wallet.pubKey != pubKey) return false;
        }

        return true;
    }

    //keysECDSA = {pubECDSA, privECDSA}
    async createKeys(ctx, pubECDSA, privECDSA) {

        //Create RSA keys  
        const keyRSA = new NodeRSA({ b: 512 });
        let pubRSA = keyRSA.exportKey('components-public')
        let privRSA = keyRSA.exportKey()

        //Generate hash
        let hashPrivECDSA = sha256(privECDSA)

        //Encrypt PUBLIC key ECDSA
        let cypherPubECDSA = keyRSA.encrypt(pubECDSA)

        //Encrypt private key RSA
        let cypherPrivRSA = ((CryptoJS.AES.encrypt(privRSA, hashPrivECDSA)).toString());

        //Create key asset
        let keys = {
            pubRSA,
            cypherPrivRSA,
            owner:cypherPubECDSA,
            type:'key'
        }

        let key = `key_${pubECDSA}`

        await ctx.stub.putState(key, Buffer.from(JSON.stringify(keys)));
        return `Keys have been created`;

    }


    async queryKeys(ctx, pubECDSA) {
        
        let key = `key_${pubECDSA}`
        const keyAsBytes = await ctx.stub.getState(key);
        if (!keyAsBytes || keyAsBytes.length === 0) {
            return null
        }else{
            return (JSON.parse(keyAsBytes.toString()))
        }   

        


    }

}

module.exports = WalletsContract;