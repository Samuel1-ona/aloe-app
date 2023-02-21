import { useMemo } from 'react';

import { Display, Text } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';

import { computeLiquidationThresholds, getAssets, sqrtRatioToPrice } from '../../data/BalanceSheet';
import { RESPONSIVE_BREAKPOINT_MD, RESPONSIVE_BREAKPOINT_SM } from '../../data/constants/Breakpoints';
import { MarginAccount } from '../../data/MarginAccount';
import { formatTokenAmount } from '../../util/Numbers';

const BORROW_TITLE_TEXT_COLOR = 'rgba(130, 160, 182, 1)';
const MAX_HEALTH = 10;
const HEALTH_GREEN = 'rgba(0, 193, 67, 1)';
const HEALTH_YELLOW = 'rgba(242, 201, 76, 1)';
const HEALTH_RED = 'rgba(235, 87, 87, 1)';

const MetricCardContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  background-color: rgb(13, 23, 30);
  border-radius: 8px;
  padding: 16px;
`;

const HorizontalMetricCardContainer = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  background-color: rgb(13, 23, 30);
  border-radius: 8px;
  padding: 16px;
`;

const HealthDot = styled.div<{ color: string }>`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: ${(props) => props.color};
`;

const MetricsGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const MetricsGridUpper = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-gap: 16px;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_MD}) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: ${RESPONSIVE_BREAKPOINT_SM}) {
    grid-template-columns: 1fr;
  }
`;

const MetricsGridLower = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  grid-gap: 16px;
`;

function getHealthColor(health: number) {
  if (health <= 1.02) {
    return HEALTH_RED;
  } else if (health <= 1.25) {
    return HEALTH_YELLOW;
  } else {
    return HEALTH_GREEN;
  }
}

function MetricCard(props: { label: string; value: string }) {
  const { label, value } = props;
  return (
    <MetricCardContainer>
      <Text size='M' color={BORROW_TITLE_TEXT_COLOR}>
        {label}
      </Text>
      <Display size='L'>{value}</Display>
    </MetricCardContainer>
  );
}

function HorizontalMetricCard(props: { label: string; value: string }) {
  const { label, value } = props;
  return (
    <HorizontalMetricCardContainer>
      <Text size='M' color={BORROW_TITLE_TEXT_COLOR}>
        {label}
      </Text>
      <Display size='S'>{value}</Display>
    </HorizontalMetricCardContainer>
  );
}

function HealthMetricCard(props: { health: number }) {
  const { health } = props;
  const healthLabel = health > MAX_HEALTH ? `${MAX_HEALTH}+` : health.toFixed(2);
  const healthColor = getHealthColor(health);
  return (
    <HorizontalMetricCardContainer>
      <Text size='M' color={BORROW_TITLE_TEXT_COLOR}>
        Health
      </Text>
      <div className='flex items-center gap-2'>
        <Display size='S' color={healthColor}>
          {healthLabel}
        </Display>
        <HealthDot color={healthColor} />
      </div>
    </HorizontalMetricCardContainer>
  );
}

export type BorrowMetricsProps = {
  marginAccount?: MarginAccount;
  dailyInterest0: number;
  dailyInterest1: number;
};

export function BorrowMetrics(props: BorrowMetricsProps) {
  const { marginAccount, dailyInterest0, dailyInterest1 } = props;

  const maxSafeCollateralFall = useMemo(() => {
    if (!marginAccount) return null;

    const { lowerSqrtRatio, upperSqrtRatio, minSqrtRatio, maxSqrtRatio } = computeLiquidationThresholds(
      marginAccount.assets,
      marginAccount.liabilities,
      [], // TODO: We should actually fetch Uniswap positions
      marginAccount.sqrtPriceX96,
      marginAccount.iv,
      marginAccount.token0.decimals,
      marginAccount.token1.decimals
    );

    if (lowerSqrtRatio.eq(minSqrtRatio) && upperSqrtRatio.eq(maxSqrtRatio)) return Number.POSITIVE_INFINITY;

    const [current, lower, upper] = [marginAccount.sqrtPriceX96, lowerSqrtRatio, upperSqrtRatio].map((sp) =>
      sqrtRatioToPrice(sp, marginAccount.token0.decimals, marginAccount.token1.decimals)
    );

    const assets = getAssets(
      marginAccount.assets,
      [], // TODO: We should actually fetch Uniswap positions
      marginAccount.sqrtPriceX96,
      lowerSqrtRatio,
      upperSqrtRatio,
      marginAccount.token0.decimals,
      marginAccount.token1.decimals
    );

    // Compute the value of all assets (collateral) at 3 different prices (current, lower, and upper)
    // Denominated in units of token1
    let assetValueCurrent = (assets.fixed0 + assets.fluid0C) * current + assets.fixed1 + assets.fluid1C;
    let assetValueAtLower = assets.fixed0 * lower + assets.fixed1 + assets.fluid1A;
    let assetValueAtUpper = assets.fixed0 * upper + assets.fixed1 + assets.fluid1B;

    // If there are no assets, further results would be spurious, so return null
    if (assetValueCurrent < Number.EPSILON) return null;

    // Compute how much the collateral can drop in value while remaining solvent
    const percentChange1A = Math.abs(assetValueCurrent - assetValueAtLower) / assetValueCurrent;
    const percentChange1B = Math.abs(assetValueCurrent - assetValueAtUpper) / assetValueCurrent;
    const percentChange1 = Math.min(percentChange1A, percentChange1B);

    // Now change to units of token0
    assetValueCurrent /= current;
    assetValueAtLower /= lower;
    assetValueAtUpper /= upper;

    // Again compute how much the collateral can drop in value while remaining solvent,
    // but this time percentages are based on units of token0
    const percentChange0A = Math.abs(assetValueCurrent - assetValueAtLower) / assetValueCurrent;
    const percentChange0B = Math.abs(assetValueCurrent - assetValueAtUpper) / assetValueCurrent;
    const percentChange0 = Math.min(percentChange0A, percentChange0B);

    // Since we don't know whether the user is thinking in terms of "X per Y" or "Y per X",
    // we return the minimum. Error on the side of being too conservative.
    return Math.min(percentChange0, percentChange1);
  }, [marginAccount]);

  if (!marginAccount) return null;

  let liquidationDistanceText = '-';
  if (maxSafeCollateralFall !== null) {
    if (maxSafeCollateralFall === Number.POSITIVE_INFINITY) liquidationDistanceText = '∞';
    else liquidationDistanceText = `${(maxSafeCollateralFall * 100).toPrecision(2)}% drop in collateral value`;
  }

  return (
    <MetricsGrid>
      <MetricsGridUpper>
        <MetricCard
          label={`${marginAccount.token0.ticker} Collateral`}
          value={formatTokenAmount(marginAccount.assets.token0Raw || 0, 3)}
        />
        <MetricCard
          label={`${marginAccount.token1.ticker} Collateral`}
          value={formatTokenAmount(marginAccount.assets.token1Raw || 0, 3)}
        />
        <MetricCard
          label={`${marginAccount.token0.ticker} Borrows`}
          value={formatTokenAmount(marginAccount.liabilities.amount0 || 0, 3)}
        />
        <MetricCard
          label={`${marginAccount.token1.ticker} Borrows`}
          value={formatTokenAmount(marginAccount.liabilities.amount1 || 0, 3)}
        />
      </MetricsGridUpper>
      <MetricsGridLower>
        <HealthMetricCard health={marginAccount.health || 0} />
        <HorizontalMetricCard label='Liquidation Distance' value={liquidationDistanceText} />
        <HorizontalMetricCard
          label='Daily Interest'
          value={`${formatTokenAmount(dailyInterest0, 2)} ${marginAccount.token0.ticker} + ${formatTokenAmount(
            dailyInterest1,
            2
          )} ${marginAccount.token1.ticker}`}
        />
      </MetricsGridLower>
    </MetricsGrid>
  );
}