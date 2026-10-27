import test from 'node:test';
import assert from 'node:assert/strict';
import {mapFavoriteProduct} from '../lib/favorite-product.ts';

test('favorites retain the gift marker for free listings created before this fix',()=>{
 const saved=mapFavoriteProduct({id:'favorite',product_id:'product',price:'0',description:'Tặng miễn phí. Sách còn tốt',title:'Sách',status:'Active',price_alert_enabled:true});
 assert.equal(saved.productId,'product');assert.equal(saved.id,'favorite');assert.equal(saved.price,0);assert.equal(saved.freeGift,true);assert.equal(saved.description,'Tặng miễn phí. Sách còn tốt');assert.equal(saved.priceAlertEnabled,true);
});
test('a zero-price exchange stays an exchange and a paid listing stays a sale',()=>{
 assert.equal(mapFavoriteProduct({price:'0',description:'Đổi lấy sách khác'}).freeGift,false);
 const paid=mapFavoriteProduct({price:'50000',description:'Tặng miễn phí. Kèm phụ kiện'});
 assert.equal(paid.freeGift,false);assert.equal(paid.price,50000);
});
test('missing legacy description safely defaults to an exchange',()=>{
 assert.equal(mapFavoriteProduct({price:'0',description:null}).freeGift,false);
 assert.equal(mapFavoriteProduct({price:'0'}).description,'');
});
