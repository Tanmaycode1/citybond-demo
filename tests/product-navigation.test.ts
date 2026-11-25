import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import seed from "../src/data/site.json";
import { validateContent } from "../src/lib/cms/schema";
import { navigationWithProducts, productMenuCategory, productMenuCategories, productPath } from "../src/lib/product-navigation";
import { canonicalHref, resolveRoute, sitemapPaths } from "../src/lib/routes";
import { previewHref } from "../src/lib/navigation";
import { getEditorState, getPublicContent, publishDraft, saveDraft } from "../src/lib/cms/content";

function content() {
  const c=validateContent(seed);
  c.products.push({...c.products[0],slug:"owner-added-panel",name:"Owner panel",source:"",menuCategory:"",category:"ACP"});
  return c;
}
test("new catalogue products automatically enter the menu without modifying manual informational links",()=>{
  const c=content(),before=JSON.stringify(c.site.nav),menu=navigationWithProducts(c)[0];
  const added=menu.children.find(link=>link.href==="/products/owner-added-panel");
  assert.deepEqual(added,{label:"Owner panel",href:"/products/owner-added-panel",group:"ACP"});
  for(const product of c.products)assert.equal(menu.children.filter(link=>canonicalHref(link.href)===productPath(product)).length,1);
  assert.ok(menu.children.some(link=>link.href==="/3mm-acp-sheet"&&link.group==="Thickness"));
  assert.equal(JSON.stringify(c.site.nav),before);
  assert.equal(productMenuCategory(c.products[0],c),"Collections");
  assert.deepEqual(navigationWithProducts(c).slice(1),c.site.nav.slice(1));
});
test("changing a product name or menu category updates one entry and retains its URL",()=>{
  const c=content(),product=c.products.at(-1)!;
  c.site.nav[0].children.push({label:"Old name",href:productPath(product),group:"Old category"});
  c.site.nav[0].children.push({label:"Duplicate",href:productPath(product),group:"Other category"});
  product.name="Updated panel";product.menuCategory="Special facades";
  const matches=navigationWithProducts(c)[0].children.filter(link=>link.href===productPath(product));
  assert.deepEqual(matches,[{label:"Updated panel",href:productPath(product),group:"Special facades"}]);
  assert.ok(productMenuCategories(c).includes("Special facades"));
  c.productMenuCategories=["Unused new category"];
  assert.ok(productMenuCategories(c).includes("Unused new category"));
  assert.ok(!navigationWithProducts(c)[0].children.some(link=>link.group==="Unused new category"));
  assert.equal(resolveRoute(productPath(product),c),"products/owner-added-panel");
  assert.ok(sitemapPaths(c).includes(productPath(product)));
});
test("renamed product menu and original aliases remain supported, removed custom links do not survive",()=>{
  const c=content();c.site.nav[0].label="Our materials";
  c.products[0].menuCategory="Architectural surfaces";
  c.site.nav[0].children.push({label:"Duplicate Lamio",href:"/products/lamio-series",group:"Other"},{label:"Deleted product",href:"/products/deleted-item",group:"ACP"});
  const menu=navigationWithProducts(c)[0];assert.equal(menu.label,"Our materials");
  assert.equal(menu.children.filter(link=>link.href==="/lamio-series").length,1);
  assert.equal(menu.children.find(link=>link.href==="/lamio-series")?.group,"Architectural surfaces");
  assert.ok(!menu.children.some(link=>link.href==="/products/deleted-item"));
});
test("draft links retain role, anchors and preview mode without changing public or download links",()=>{
  assert.equal(previewHref("/products/owner-added-panel?role=architect#product-overview",true),"/products/owner-added-panel?role=architect&preview=1#product-overview");
  assert.equal(previewHref("/?preview=1",true),"/?preview=1");
  for(const href of ["https://example.com/x","//example.com/x","/api/media/file.png","/studio-7c9e","/assets/catalogue.pdf"])assert.equal(previewHref(href,true),href);
  assert.equal(previewHref("/products/owner-added-panel",false),"/products/owner-added-panel");
});
test("publication makes a saved product, its category, route and sitemap available in the same revision",async()=>{
  const root=await mkdtemp(tmpdir()+"/citybond-product-menu-"),previous=process.env.CMS_LOCAL_DIR;process.env.CMS_LOCAL_DIR=root;
  try{
    const c=content();c.products.at(-1)!.menuCategory="New collection";
    const draft=await saveDraft(c,null),editor=await getEditorState();
    assert.ok(!editor.publishedProductSlugs.includes("owner-added-panel"));
    assert.equal(resolveRoute("products/owner-added-panel",await getPublicContent()),null);
    assert.ok(navigationWithProducts(editor.content)[0].children.some(link=>link.group==="New collection"));
    const publication=await publishDraft(draft.draftEtag,null);
    assert.ok(publication.publishedProductSlugs.includes("owner-added-panel"));
    const live=await getPublicContent();
    assert.equal(resolveRoute("products/owner-added-panel",live),"products/owner-added-panel");
    assert.ok(navigationWithProducts(live)[0].children.some(link=>link.href==="/products/owner-added-panel"&&link.group==="New collection"));
    assert.ok(sitemapPaths(live).includes("/products/owner-added-panel"));
  }finally{if(previous===undefined)delete process.env.CMS_LOCAL_DIR;else process.env.CMS_LOCAL_DIR=previous;await rm(root,{recursive:true,force:true});}
});
