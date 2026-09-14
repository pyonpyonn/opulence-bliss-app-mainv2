import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                Your account is ready
              </CardTitle>
              <CardDescription>You can sign in now</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                You&apos;ve successfully signed up. No email confirmation is required.
              </p>
              <Link
                href="/login"
                className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-violet-700 px-5 py-3 text-sm font-bold text-white"
              >
                Log in
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
