import { z } from "zod";

// Indian 6-digit PIN code: first digit 1-9 (no leading zero), remaining 5 digits any.
export const PINCODE_REGEX = /^[1-9][0-9]{5}$/;

export const pincodeSchema = z
  .string()
  .regex(PINCODE_REGEX, "Enter a valid 6-digit pincode");

export const optionalPincodeSchema = z
  .string()
  .optional()
  .refine((v) => !v || PINCODE_REGEX.test(v), "Enter a valid 6-digit pincode");
