'use strict';
const { Contract } = require('fabric-contract-api');



class CreateProductContract extends Contract {

    constructor() {
        // Unique namespace when multiple contracts per chaincode file
        super('createProductContract');
    }



    async upgrade(ctx) {

    }


    async create(ctx, id, ownerPubKey, data) {

        let key = ('Product' + id);
        let productAsBytes = await ctx.stub.getState(key);

        if (!productAsBytes || productAsBytes.length === 0) {

            const walletKey = 'Wallets';
            const walletsAsBytes = await ctx.stub.getState(walletKey);

            if (!walletsAsBytes || walletsAsBytes.length === 0) {

                throw new Error(`No se econtró el registro de wallets`);

            }
            else {

                let walletsObject = JSON.parse(walletsAsBytes.toString());
                const walletsArray = walletsObject.wallets;
                let i = 0;

                while (i < walletsArray.length && walletsArray[i].pubkey != ownerPubKey) {
                    i = i + 1;
                }

                if (i < walletsArray.length) {
                    const product = {
                        id,
                        ownerPubKey,
                        data
                    }
                    //Add to Ledger
                    await ctx.stub.putState('Product' + product.id, Buffer.from(JSON.stringify(product)));

                    //Add to Wallet
                    walletsArray[i].assets.push(key);
                    walletsObject.wallets = walletsArray
                    await ctx.stub.putState(walletKey, Buffer.from(JSON.stringify(walletsObject)));

                    return product

                } 
                else throw new Error `No se encontró la wallet ${ownerPubKey}`
                

            }
        } 
        else throw new Error(`El producto con  id ${id} ya fue registrado`);
        

    }




}
module.exports = CreateProductContract;