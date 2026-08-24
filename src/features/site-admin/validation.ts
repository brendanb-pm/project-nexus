import { serviceTypes, type ServiceType } from "@/domain/model";
import {
  lifecycleStatuses,
  type LifecycleStatus,
} from "@/features/client-admin/contracts";
import { ValidationError } from "@/server/request/errors";
import {
  armedRequirements,
  type ArmedRequirement,
  type CreatePostInput,
  type CreateSiteInput,
} from "./contracts";
function required(value: unknown, field: string, label: string, max = 160) {
  if (typeof value !== "string" || !value.trim())
    throw new ValidationError({ [field]: [`${label} is required.`] });
  const result = value.trim();
  if (result.length > max)
    throw new ValidationError({
      [field]: [`${label} must be ${max} characters or fewer.`],
    });
  return result;
}
function status(value: unknown): LifecycleStatus {
  if (
    typeof value !== "string" ||
    !lifecycleStatuses.includes(value as LifecycleStatus)
  )
    throw new ValidationError({ status: ["Select a valid status."] });
  return value as LifecycleStatus;
}
function timezone(value: unknown) {
  const result = required(value, "timezone", "Timezone", 80);
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: result }).format();
  } catch {
    throw new ValidationError({ timezone: ["Enter a valid IANA timezone."] });
  }
  return result;
}
function coordinate(
  value: unknown,
  field: "latitude" | "longitude",
  min: number,
  max: number,
) {
  if (value == null || value === "") return undefined;
  const result = Number(value);
  if (!Number.isFinite(result) || result < min || result > max)
    throw new ValidationError({
      [field]: [`${field} must be between ${min} and ${max}.`],
    });
  return result;
}
function radius(value: unknown) {
  if (value == null || value === "") return undefined;
  const result = Number(value);
  if (!Number.isInteger(result) || result < 10 || result > 5000)
    throw new ValidationError({
      geofenceRadiusMeters: [
        "Geofence radius must be between 10 and 5000 meters.",
      ],
    });
  return result;
}
export function validateSite(input: CreateSiteInput) {
  const latitude = coordinate(input.latitude, "latitude", -90, 90);
  const longitude = coordinate(input.longitude, "longitude", -180, 180);
  if ((latitude == null) !== (longitude == null))
    throw new ValidationError({
      latitude: ["Provide both latitude and longitude, or neither."],
      longitude: ["Provide both latitude and longitude, or neither."],
    });
  return {
    clientId: required(input.clientId, "clientId", "Client"),
    name: required(input.name, "name", "Site name", 120),
    address: {
      line1: required(input.addressLine1, "addressLine1", "Address", 160),
      city: required(input.city, "city", "City", 100),
      region: required(input.region, "region", "State or region", 100),
      postalCode: required(input.postalCode, "postalCode", "Postal code", 24),
      country: required(input.country, "country", "Country", 2).toUpperCase(),
    },
    timezone: timezone(input.timezone),
    latitude,
    longitude,
    geofenceRadiusMeters: radius(input.geofenceRadiusMeters),
    status: status(input.status),
  };
}
export function validatePost(input: CreatePostInput) {
  const serviceType = required(
    input.serviceType,
    "serviceType",
    "Service type",
  ) as ServiceType;
  if (!serviceTypes.includes(serviceType))
    throw new ValidationError({
      serviceType: ["Select an approved static/uniformed service type."],
    });
  const armedRequirement = required(
    input.armedRequirement,
    "armedRequirement",
    "Armed requirement",
  ) as ArmedRequirement;
  if (!armedRequirements.includes(armedRequirement))
    throw new ValidationError({
      armedRequirement: ["Select a valid armed requirement."],
    });
  const requirements =
    typeof input.qualificationRequirements === "string"
      ? [
          ...new Set(
            input.qualificationRequirements
              .split(/[\n,]/)
              .map((v) => v.trim())
              .filter(Boolean),
          ),
        ].slice(0, 20)
      : [];
  if (requirements.some((v) => v.length > 80))
    throw new ValidationError({
      qualificationRequirements: [
        "Each qualification must be 80 characters or fewer.",
      ],
    });
  return {
    siteId: required(input.siteId, "siteId", "Site"),
    name: required(input.name, "name", "Post name", 120),
    description: required(
      input.description,
      "description",
      "Description",
      1000,
    ),
    serviceType,
    armedRequirement,
    qualificationRequirements: requirements,
    status: status(input.status),
  };
}
export function validateVersion(value: unknown) {
  const result = required(value, "expectedUpdatedAt", "Record version", 40);
  if (Number.isNaN(Date.parse(result)))
    throw new ValidationError({
      expectedUpdatedAt: ["Refresh the record and try again."],
    });
  return result;
}
