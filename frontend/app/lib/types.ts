export type Category = {
  id: string;
  description: string;
  descriptionI18n?: Record<string, string> | null;
  taxonomyType: string;
  blockId?: string | null;
  parentId?: string | null;
  order?: number;
  isPublicVisible?: boolean;
  isPrimaryCategory?: boolean;
  iconImageUrl?: string | null;
  cardImageUrl?: string | null;
  children?: Category[];
  createdAt: string;
  updatedAt: string;
};

export type FilterOption = {
  id: string;
  groupId: string;
  label: string;
  labelI18n?: Record<string, string> | null;
  value: string;
  order: number;
  parentId: string | null;
  children?: FilterOption[];
};

export type FilterGroup = {
  id: string;
  key: string;
  label: string;
  labelI18n?: Record<string, string> | null;
  imageUrl?: string | null;
  taxonomyType?: string | null;
  isProfileBlock?: boolean | null;
  // "multi" = checkboxes; "range" = min/max; "single" reserved
  type: "multi" | "range" | "single";
  order: number;
  isPublicVisible?: boolean | null;
  min: number | null;
  max: number | null;
  options?: FilterOption[];
};

export type Publication = {
  id: string;
  createdAt: string;
  updatedAt: string;

  status: string;
  featured: boolean;

  title: string;
  titleI18n?: Record<string, string> | null;
  description: string;
  descriptionI18n?: Record<string, string> | null;
  primaryGroupKey: string | null;
  contentLanguage: string | null;
  publisherName: string | null;
  category: string | null;
  categoryI18n?: Record<string, string> | null;
  subcategory: string | null;
  subcategoryI18n?: Record<string, string> | null;
  country: string | null;
  headquarterCountry: string | null;
  city: string | null;
  location: any | null;
  userType: string | null;
  subUserType: string | null;
  serviceType: string | null;
  userRol: string | null;
  activity: string | null;
  currency: string | null;
  price: string | null;
  languages: any;
  fields: any;
  images: string[] | any;
  website: string | null;
  socialLinks: any;
  expiration: string | null;
  filterOptions?: {
    filterOptionId: string;
    filterOption: FilterOption;
  }[];
};

export type Paginated<T> = {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  items: T[];
};
