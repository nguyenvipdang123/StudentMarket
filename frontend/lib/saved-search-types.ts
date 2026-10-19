export type NeedFilters={q:string;category:string;kind:string;condition:string;school:string;minPrice:string;maxPrice:string};
export type SavedSearch={id:string;name:string;enabled:boolean;filters:NeedFilters;href:string};
export const emptyNeedFilters:NeedFilters={q:'',category:'Tất cả',kind:'all',condition:'',school:'',minPrice:'',maxPrice:''};
