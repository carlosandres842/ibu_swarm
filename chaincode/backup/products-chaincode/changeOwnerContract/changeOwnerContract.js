'use strict';
const { Contract } = require('fabric-contract-api');

class ChangeOwnerContract extends Contract {


    constructor() {
        // Unique namespace when multiple contracts per chaincode file
        super('changeOwnerContract');
    }


    async upgrade(ctx) {
    }


    async changeOwner(ctx, id, ownerPubKey, newPubKey) {
        const key = ('Product' + id);
        const productAsBytes = await ctx.stub.getState(key);

        if (!productAsBytes || productAsBytes.length === 0) {
            throw new Error(`El producto ${key} no existe`);
        }
        else {
            const walletKey = ('Wallets');
            const walletsAsBytes = await ctx.stub.getState(walletKey);

            if (!walletsAsBytes || walletsAsBytes.length === 0) {
                throw new Error(`No se econtró el registro de wallets`);
            }
            else {

                let walletsObject = JSON.parse(walletsAsBytes.toString());
                const walletsArray = walletsObject.wallets;
                let i = 0; 

                //Search new Wallet
                while (i < walletsArray.length && walletsArray[i].pubkey != newPubKey) {
                    i = i + 1;
                }

                if (i >= walletsArray.length) {
                    throw new Error(`No se econtró la wallet de destino ${newPubKey}`);
                }
                else{
                    let j = 0; let k=0;
                    //searh current pubkey
                    while (j < walletsArray.length && walletsArray[j].pubkey != ownerPubKey) {
                        j = j + 1;
                    }
                    if (j >= walletsArray.length) {
                        throw new Error(`No se econtró la wallet del propietario ${ownerPubKey}`);
                    }
                    else{
                        //set new pubkey to product
                        const product = JSON.parse(productAsBytes.toString());
                        if (product.ownerPubKey === ownerPubKey) {
                            //update ledger with product
                            product.ownerPubKey = newPubKey
                            await ctx.stub.putState(key, Buffer.from(JSON.stringify(product)));
                        } 
                        else {
                            throw new Error(`El produco ${id} no pertenece a la wallet ${ownerPubKey}`);
                        }
                        while (walletsArray[j].assets[k] != key) {
                            k = k + 1;
                        }
                        //delete product from de current pubkey
                        walletsArray[j].assets.splice(k, 1);
                        //set product to new pubkey
                        walletsArray[i].assets.push(key);  
    
                        //Update wallets in ledger
                        walletsObject.wallets = walletsArray
                        await ctx.stub.putState(walletKey, Buffer.from(JSON.stringify(walletsObject)));
    
                        return product;

                    }
                    
                }

            }

        }

    }





}
module.exports = ChangeOwnerContract;