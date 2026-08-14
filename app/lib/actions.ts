"use server";

import postgres from "postgres";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn } from "@/auth";

const sql = postgres(process.env.POSTGRES_URL!, { ssl: "require" });

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({
    invalid_type_error: "Please select a customer.",
  }),
  amount: z.coerce
    .number()
    .gt(0, { message: "Please enter an amount greater than $0." }),
  status: z.enum(["pending", "paid"], {
    invalid_type_error: "Please select an invoice status.",
  }),
  date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

export async function createInvoice(prevState: State, formData: FormData) {
  // Validate form fields using Zod
  const validatedFields = CreateInvoice.safeParse({
    customerId: formData.get("customerId"),
    amount: formData.get("amount"),
    status: formData.get("status"),
  });

  // If form validation fails, return errors early. Otherwise, continue.
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Missing fields. Failed to create invoice.",
    };
  }

  // Prepare data
  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = Math.round(amount * 100);
  const date = new Date().toISOString().split("T")[0];
  // NOTE: Tutorial says to carry amount as amountInCents to "avoid floating-point errors".
  // Seems we're actually introducing this error, as $9.99 works, but $9.95 and $9.96 fails.
  // console.log shows 9.95 * 100 = 994.9999999999999, and 9.96 * 100 = 996.0000000000001
  // FIX: Use amountInCents = Math.round(amount * 100)

  // Insert data into database
  try {
    await sql`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `;
  } catch (error) {
    // If a database error occurs, return a more specific error.
    return { message: "Database Error: Failed to create invoice." };
  }

  // Revalidate cache for invoices page and redirect user
  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
}

export async function updateInvoice(
  id: string,
  prevState: State,
  formData: FormData,
) {
  // Validate form fields using Zod
  const validatedFields = UpdateInvoice.safeParse({
    customerId: formData.get("customerId"),
    amount: formData.get("amount"),
    status: formData.get("status"),
  });

  // If form validation fails, return errors early. Otherwise, continue.
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Missing fields. Failed to update invoice.",
    };
  }

  // Prepare data
  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = Math.round(amount * 100);

  // Update data in database
  try {
    await sql`
      UPDATE invoices
      SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
      WHERE id = ${id}
    `;
  } catch (error) {
    // If a database error occurs, return a more specific error.
    return { message: "Database Error: Failed to update invoice." };
  }

  // Revalidate cache for invoices page and redirect user
  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
}

export async function deleteInvoice(id: string) {
  // Delete data from database
  try {
    await sql`DELETE FROM invoices WHERE id = ${id}`;
  } catch (error) {
    console.error(error);
    return { message: "Database Error: Failed to delete invoice." };
  }

  // Revalidate cache for invoices page
  revalidatePath("/dashboard/invoices");
}

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn("credentials", formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return "Invalid credentials.";
        default:
          return "Something went wrong.";
      }
    }
    throw error;
  }
}
