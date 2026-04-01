const calculateTrend = (current, previous) => {
  if (previous === 0 && current === 0)
    return { percentage: 0, direction: "equal" };
  if (previous === 0) return { percentage: 100, direction: "increasing" };
  const change = ((current - previous) / previous) * 100;
  const percentage = Math.round(Math.abs(change) * 10) / 10;
  if (change > 0) return { percentage, direction: "increasing" };
  if (change < 0) return { percentage, direction: "declining" };
  return { percentage: 0, direction: "equal" };
};

module.exports = calculateTrend;
