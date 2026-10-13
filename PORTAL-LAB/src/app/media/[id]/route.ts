import { mediaResponse } from "@/lib/catalog";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return mediaResponse((await params).id);
}
