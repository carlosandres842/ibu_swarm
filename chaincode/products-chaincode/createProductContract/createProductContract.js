'use strict';
const { Contract } = require('fabric-contract-api');



class CreateProductContract extends Contract {

    constructor() {
        // Unique namespace when multiple contracts per chaincode file
        super('createProductContract');
    }



    async upgrade(ctx) {

    }

    //owner = pubECDSA
    async create(ctx, id, owner, data) {

        let productKey = ('Product' + id);
        let productAsBytes = await ctx.stub.getState(productKey);

        if (!productAsBytes || productAsBytes.length === 0) {

            const walletKey = ('Wallet' + owner);
            const walletAsBytes = await ctx.stub.getState(walletKey);

            if (!walletAsBytes || walletAsBytes.length === 0) {

                return (`Wallet not found`);
            }
            else {

                let wallet = JSON.parse(walletAsBytes.toString());

                //Add product to Ledger
                let product = {
                    id,
                    owner,
                    data,
                    type: 'asset'
                };
                await ctx.stub.putState(productKey, Buffer.from(JSON.stringify(product)));

                //Add to Wallet
		let dataObject = JSON.parse(data);
                wallet.assets.push({id:id,name:dataObject.name});
                await ctx.stub.putState(walletKey, Buffer.from(JSON.stringify(wallet)));

                return product;
            }
        }

        throw new Error( `Product with id ${id} has already been registered`)
       
    }




}
module.exports = CreateProductContract;
