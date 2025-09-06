import { createCivicAuthPlugin } from "@civic/auth/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

const withCivicAuth = createCivicAuthPlugin({
  clientId: process.env.CIVIC_CLIENT_ID || ""
});

export default withCivicAuth(nextConfig);
