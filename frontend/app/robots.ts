import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard/", "/projects/", "/settings/", "/billing/", "/login", "/register"],
    },
    sitemap: "https://www.flowfd.com/sitemap.xml",
  };
}
