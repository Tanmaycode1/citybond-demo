import Link from "next/link";
export default function NotFound() {
  return (
    <main className="wrap section">
      <p className="eyebrow">404 / CityBond</p>
      <h1>
        A different
        <br />
        <em>direction.</em>
      </h1>
      <p style={{ margin: "30px 0" }}>This page could not be found.</p>
      <Link className="button" href="/">
        Back to CityBond ↗
      </Link>
    </main>
  );
}
