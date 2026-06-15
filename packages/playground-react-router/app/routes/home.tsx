import { useLoaderData } from "react-router";

// Runs on the server, where the launch script's env is visible (D4).
export function loader() {
  return { name: process.env["PREVIEW_NAME"] ?? "hub" };
}

export default function Home() {
  const data = useLoaderData<typeof loader>();
  return (
    <main>
      <h1>Preview: {data.name}</h1>
      <p>React Router framework mode, mounted under its basename.</p>
    </main>
  );
}
