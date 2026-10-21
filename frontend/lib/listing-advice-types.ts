export const adviceFields=['title','description','photos','category','condition','price','location'] as const;
export type AdviceField=typeof adviceFields[number];
export type ListingAdvice={summary:string;suggestedTitle:string;imagesChecked:number;issues:{field:AdviceField;photoIndex:number;message:string;suggestion:string}[]};
export const adviceFieldLabels:Record<AdviceField,string>={title:'Tiêu đề',description:'Mô tả',photos:'Ảnh',category:'Danh mục',condition:'Tình trạng',price:'Giá',location:'Khu vực hẹn gặp'};
export const maxAdviceImages=8;
export const maxAdviceImageBytes=1_000_000;
export const maxAdviceRequestBytes=8_200_000;
