const CF_ACCOUNT_ID = "bea831fb5da222836d44f9c69c46b9e7";
const CF_D1_DATABASE_ID = "834e16c2-f109-47db-9d16-14917bcd9876";

function getApiToken(): string {
  const token = process.env.CF_API_TOKEN;
  if (!token) throw new Error("Missing CF_API_TOKEN env var");
  return token;
}

type D1Result = {
  results: Record<string, unknown>[];
  success: boolean;
  meta: Record<string, unknown>;
};

export async function d1Query(
  sql: string,
  params: unknown[] = [],
): Promise<D1Result> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${CF_D1_DATABASE_ID}/query`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${getApiToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql, params }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`D1 query failed (${response.status}): ${text.slice(0, 200)}`);
  }

  const data = await response.json() as {
    result: D1Result[];
    success: boolean;
    errors: { message: string }[];
  };

  if (!data.success || data.errors?.length > 0) {
    throw new Error(`D1 error: ${data.errors?.[0]?.message ?? "Unknown"}`);
  }

  return data.result[0];
}

export async function d1Execute(sql: string, params: unknown[] = []): Promise<number> {
  const result = await d1Query(sql, params);
  return (result.meta?.changes as number) ?? 0;
}
