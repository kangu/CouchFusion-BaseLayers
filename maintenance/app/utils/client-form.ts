export interface NormalizedGasSensorFormFields {
  gasSensorExpirationDate: string | null;
  gasSensorPeriodMonths: number | null;
}

export const normalizeGasSensorFormFields = (input: {
  gasSensorExpirationDate: string;
  gasSensorPeriodMonths: string;
}): NormalizedGasSensorFormFields => {
  const expirationDate = input.gasSensorExpirationDate.trim();
  if (!expirationDate) {
    return {
      gasSensorExpirationDate: null,
      gasSensorPeriodMonths: null,
    };
  }

  const rawPeriod = input.gasSensorPeriodMonths.trim();
  const parsedPeriod = Number.parseInt(rawPeriod, 10);

  return {
    gasSensorExpirationDate: expirationDate,
    gasSensorPeriodMonths: Number.isInteger(parsedPeriod) ? parsedPeriod : null,
  };
};
