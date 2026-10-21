import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultExploreFilters,readExploreFilters,writeExploreFilters} from '../lib/explore-url-state.ts';

test('share/reload preserves every filter and page without taking unrelated URL parameters',()=>{
  const filters={...defaultExploreFilters,search:'laptop cũ',category:'Công nghệ',sort:'price-asc',kind:'sell',condition:'Tốt',school:'ĐH Công nghệ Đồng Nai',minPrice:'0',maxPrice:'5000000',page:3};
  const params=writeExploreFilters(filters,new URLSearchParams('auth=login&utm_source=test'));
  assert.deepEqual(readExploreFilters(params),filters);assert.equal(params.get('auth'),'login');assert.equal(params.get('utm_source'),'test');
  const cleared=writeExploreFilters(defaultExploreFilters,params);assert.equal(cleared.has('q'),false);assert.equal(cleared.has('page'),false);assert.equal(cleared.has('sort'),false);assert.equal(cleared.get('school'),'');
  assert.equal(readExploreFilters(cleared,'DNTU').school,'');
});
test('malformed links use safe defaults and explicit schools override local preferences',()=>{
  const state=readExploreFilters(new URLSearchParams('page=Infinity&category=invalid&sort=invalid&kind=invalid&condition=invalid&minPrice=-1&maxPrice=1e5&q='+ 'x'.repeat(201)), 'DNTU');
  assert.deepEqual(state,{...defaultExploreFilters,school:'DNTU'});
  assert.equal(readExploreFilters(new URLSearchParams('school=UEH&page=2'),'DNTU').school,'UEH');
  assert.equal(readExploreFilters(new URLSearchParams('page=2')).page,2);
});
