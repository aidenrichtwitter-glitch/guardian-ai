export const getBaseUrl = () => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  return baseUrl || "http://localhost:3000";
};

export const baseUrl = getBaseUrl();
