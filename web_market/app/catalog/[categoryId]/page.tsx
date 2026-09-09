import { redirect } from "next/navigation";

export default function CategoryCatalogPage({ params }: { params: { categoryId: string } }) {
  redirect(`/catalog?category=${encodeURIComponent(params.categoryId)}`);
}
