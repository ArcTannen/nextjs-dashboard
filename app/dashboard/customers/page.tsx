import CustomersTable from "@/app/ui/customers/table";
import Pagination from "@/app/ui/invoices/pagination";
import { Metadata } from "next";
import { Suspense } from "react";
import { fetchFilteredCustomers } from "@/app/lib/data";
import { TableRowSkeleton } from "@/app/ui/skeletons";

export const metadata: Metadata = {
  title: "Customers",
};

export default async function Page(props: {
  searchParams?: Promise<{
    query?: string;
    //page?: string;
  }>;
}) {
  const searchParams = await props.searchParams;
  const query = searchParams?.query || "";
  //const currentPage = Number(searchParams?.page) || 1;
  const customers = await fetchFilteredCustomers(query);
  const totalPages = Math.ceil(customers.length / 6);

  return (
    <div className="w-full">
      <Suspense fallback={<TableRowSkeleton />}>
        <CustomersTable customers={customers} />
      </Suspense>
      <div className="mt-5 flex w-full justify-center">
        <Pagination totalPages={totalPages} />
      </div>
    </div>
  );
}
