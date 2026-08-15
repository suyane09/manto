import axios from "axios";
import { API_URL } from "./api";

export const CUSTOMER_TOKEN_KEY = "arsenal_customer_token";

export const customerApi = axios.create({
  baseURL: API_URL,
});

customerApi.interceptors.request.use((config) => {
  const token = localStorage.getItem(CUSTOMER_TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

customerApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem(CUSTOMER_TOKEN_KEY);
      localStorage.removeItem("arsenal_customer_profile");
      window.dispatchEvent(new Event("arsenal:customer-logout"));
    }
    return Promise.reject(err);
  }
);

export default customerApi;
