import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { palettes, contrastRatio } from '../src/tokens.ts';
import { selectSaved, selectFavorites, selectCartCount, selectCheckout } from '../src/state/selectors.ts';
import ts from 'typescript';
test('body, secondary, button and error text meet 4.5:1 in both schemes',()=>{
 for(const [scheme,c] of Object.entries(palettes)){
  for(const foreground of ['ink','muted','dark','green','brand'])for(const background of ['cream','paper','sage','peach'])assert.ok(contrastRatio(c[foreground],c[background])>=4.5,`${scheme} ${foreground}/${background}: ${contrastRatio(c[foreground],c[background])}`);
  assert.ok(contrastRatio(c.onAccent,c.green)>=4.5);assert.ok(contrastRatio(c.error,c.errorBackground)>=4.5);
 }
});
test('all mobile colour literals live in tokens; required route and strict mode exist',()=>{
 const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(new URL(e.name+'/',dir)):[new URL(e.name,dir)]);
 for(const file of walk(new URL('../src/',import.meta.url)).filter(p=>/\.(ts|tsx)$/.test(p.pathname)&&!p.pathname.endsWith('/tokens.ts')))assert.ok(!/["'`]#[\da-f]{3,8}["'`]/i.test(readFileSync(file,'utf8')),file.pathname);
 assert.match(readFileSync(new URL('../src/app/+not-found.tsx',import.meta.url),'utf8'),/router.replace/);
 assert.equal(JSON.parse(readFileSync(new URL('../tsconfig.json',import.meta.url),'utf8')).compilerOptions.strict,true);
});
test('selectors derive saved status, counts and checkout without mutating store state',()=>{
 const state={favorites:[{id:'a'}],cart:[{id:'b',sellerId:'seller',price:50000}]};assert.equal(selectSaved('a')(state),true);assert.equal(selectSaved('b')(state),false);assert.equal(selectFavorites(state),state.favorites);assert.equal(selectCartCount(state),1);assert.equal(selectCheckout('delivery')(state).total,80000);assert.equal(state.cart.length,1);
});
test('every explicit pressable control has a role and accessible label',()=>{
 const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(new URL(e.name+'/',dir)):[new URL(e.name,dir)]);
 for(const file of walk(new URL('../src/',import.meta.url)).filter(p=>p.pathname.endsWith('.tsx'))){
  const code=readFileSync(file,'utf8'),source=ts.createSourceFile(file.pathname,code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const visit=node=>{
   if((ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node))&&node.tagName.getText(source)==='Pressable'){
    const names=node.attributes.properties.filter(ts.isJsxAttribute).map(p=>p.name.getText(source));
    assert.ok(names.includes('accessibilityRole')||names.includes('role'),file.pathname+' role');
    assert.ok(names.includes('accessibilityLabel')||names.includes('aria-label'),file.pathname+' label');
   }
   ts.forEachChild(node,visit);
  };visit(source);
 }
});
