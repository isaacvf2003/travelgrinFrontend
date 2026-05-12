export type CountryListItem = {
  code: string;
  name: string;
};

export const countryList: CountryListItem[] = [
  { code: "AR", name: "Argentina" },
  { code: "BR", name: "Brasil" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Colombia" },
  { code: "ES", name: "España" },
  { code: "IT", name: "Italia" },
  { code: "MX", name: "México" },
  { code: "PT", name: "Portugal" },
  { code: "US", name: "Estados Unidos" },
  { code: "UY", name: "Uruguay" }
];

export default countryList;
