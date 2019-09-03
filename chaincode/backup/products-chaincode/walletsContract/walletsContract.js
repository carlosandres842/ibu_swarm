'use strict';
const { Contract } = require('fabric-contract-api');

class WalletsContract extends Contract {

    constructor() {
        // Unique namespace when multiple contracts per chaincode file
        super('walletsContract');
    }



    async init(ctx) {
        const wallets = { wallets: [] };
        await ctx.stub.putState('Wallets', Buffer.from(JSON.stringify(wallets)));
    }

    async upgrade(ctx) {
    }

    async createWallet(ctx, pubkey) {
        const key = ('Wallets');
        const walletsAsBytes = await ctx.stub.getState(key);
        if (!walletsAsBytes || walletsAsBytes.length === 0) {
            throw new Error(`No se econtró el registro de wallets`);
        }

        let walletsObject = JSON.parse(walletsAsBytes.toString());
        const walletsArray = walletsObject.wallets;
        walletsArray.push({ pubkey, assets: [] });
        walletsObject.wallets = walletsArray

        await ctx.stub.putState(key, Buffer.from(JSON.stringify(walletsObject)));
        return 'Wallet registrada exitosamente';
    }


    async getBalance(ctx, pubkey) {
        const key = ('Wallets');
        const walletsAsBytes = await ctx.stub.getState(key);
        if (!walletsAsBytes || walletsAsBytes.length === 0) {
            throw new Error(`No se econtró el registro de wallets`);
        }

        const walletsObject = JSON.parse(walletsAsBytes.toString());
        let walletsArray = walletsObject.wallets;
        let i = 0;
        while (i < walletsArray.length && walletsArray[i].pubkey != pubkey) {
            i = i + 1;
        }

        let response;
        if (i < walletsArray.length) {
            response = {
                assets: walletsArray[i].assets
            };
        } else {
            response = `No se encontró la wallet ${pubkey}`
        }



        return response;
    }

}
module.exports = WalletsContract;



