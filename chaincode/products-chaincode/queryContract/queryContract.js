'use strict';
const { Contract } = require('fabric-contract-api');


class QueryContract extends Contract {

    constructor() {
        // Unique namespace when multiple contracts per chaincode file
        super('queryContract');
    }

    async upgrade(ctx) {
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

    async getHistory(ctx, id) {
        let key = ('Product' + id);
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

    async getProductDetail(ctx, id) {
        let key = ('Product' + id);
        //Transform iterator to array of objects

        let productAsBytes = await ctx.stub.getState(key);

        if (!productAsBytes || productAsBytes.length === 0) {
            return (`Product ${id} not found`);
        }
        const product = JSON.parse(productAsBytes.toString());

        const history = await this.getHistory(ctx, id);

        let response = {
            product,
            history
        };

        return response;
    }


}
module.exports = QueryContract;

