export const propertyTypes: Record<string, string> = {
  house: "Casa",
  apartment: "Departamento",
  land: "Terreno",
  office: "Oficina",
  store: "Local",
  warehouse: "Depósito",
  other: "Otro",
};
export const money = (price: { amount: string; currency: string }) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: price.currency,
    maximumFractionDigits: 0,
  }).format(Number(price.amount));
