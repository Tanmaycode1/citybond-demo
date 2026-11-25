"use client";
import { useState } from "react";
import type { Product, SiteContent } from "@/lib/cms/schema";
import { productMenuCategories, productMenuCategory } from "@/lib/product-navigation";

export function ProductMenuCategory({product,content,onChange,onCreate}:{product:Product;content:SiteContent;onChange:(value:string)=>void;onCreate:(value:string)=>void}) {
  const [creating,setCreating]=useState(false),[name,setName]=useState(""),[error,setError]=useState("");
  const choices=productMenuCategories(content);
  function add() {
    const value=name.trim().replace(/\s+/g," ");
    if(!value){setError("Enter a category name.");return;}
    onCreate(choices.find(choice=>choice.toLowerCase()===value.toLowerCase())||value);
    setCreating(false);setName("");setError("");
  }
  return <div className="product-menu-category">
    <label className="editor-field">Menu category<select aria-label="Menu category" value={creating?"__new__":productMenuCategory(product,content)} onChange={e=>{if(e.target.value==="__new__"){setCreating(true);setError("");}else{setCreating(false);onChange(e.target.value);}}}>
      {choices.map(choice=><option key={choice}>{choice}</option>)}
      <option value="__new__">+ Create new category…</option>
    </select></label>
    {creating&&<div className="category-create"><label>New menu category<input autoFocus aria-label="New menu category" value={name} maxLength={80} onChange={e=>setName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();add();}if(e.key==="Escape")setCreating(false);}} /></label><button type="button" onClick={add}>Add category</button><button type="button" onClick={()=>setCreating(false)}>Cancel</button>{error&&<small role="alert">{error}</small>}</div>}
    <small>The product appears in this group under Products when you publish. You do not need to add a separate navigation link.</small>
  </div>;
}
