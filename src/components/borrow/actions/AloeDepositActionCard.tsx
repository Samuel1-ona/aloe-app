import { useEffect, useState } from 'react';
import { Dropdown, DropdownOption } from '../../common/Dropdown';
import TokenAmountInput from '../../common/TokenAmountInput';
import { BaseActionCard } from '../BaseActionCard';
import { ActionCardProps, Actions } from '../../../data/Actions';

export function AloeDepositActionCard(prop: ActionCardProps) {
  const { token0, token1, previousActionCardState, onRemove, onChange } = prop;
  const dropdownOptions: DropdownOption[] = [
    {
      label: token0?.ticker || '',
      value: token0?.address || '',
      icon: token0?.iconPath || '',
    },
    {
      label: token1?.ticker || '',
      value: token1?.address || '',
      icon: token1?.iconPath || '',
    },
  ];
  const previousTokenAmount =
    Math.min(
      previousActionCardState?.token0RawDelta || 0,
      previousActionCardState?.token1RawDelta || 0
    ) * -1;
  const [selectedToken, setSelectedToken] = useState<DropdownOption>(
    dropdownOptions[0]
  );
  const [tokenAmount, setTokenAmount] = useState<string>('');

  useEffect(() => {
    if (
      previousTokenAmount !== 0 &&
      previousTokenAmount !== parseFloat(tokenAmount)
    ) {
      setTokenAmount(
        previousTokenAmount > 0 ? previousTokenAmount.toString() : ''
      );
    }
  }, [previousActionCardState, previousTokenAmount, tokenAmount]);

  return (
    <BaseActionCard
      action='Deposit'
      actionProvider={Actions.AloeII}
      onRemove={onRemove}
    >
      <div className='w-full flex flex-col gap-4 items-center'>
        <Dropdown
          options={dropdownOptions}
          selectedOption={selectedToken}
          onSelect={(option) => {
            if (option?.value !== selectedToken?.value) {
              onChange({
                token0RawDelta: 0,
                token1RawDelta: 0,
                token0DebtDelta: 0,
                token1DebtDelta: 0,
                token0PlusDelta: 0,
                token1PlusDelta: 0,
                uniswapPositions: [],
              });
              setTokenAmount('');
            }
            setSelectedToken(option);
          }}
        />
        <TokenAmountInput
          tokenLabel={selectedToken?.label || ''}
          value={tokenAmount}
          onChange={(value) => {
            setTokenAmount(value);
            const token0Change =
              selectedToken?.value === token0?.address ? parseFloat(value) : 0;
            const token1Change =
              selectedToken?.value === token1?.address ? parseFloat(value) : 0;
            onChange({
              token0RawDelta: -token0Change,
              token1RawDelta: -token1Change,
              token0DebtDelta: 0,
              token1DebtDelta: 0,
              token0PlusDelta: token0Change,
              token1PlusDelta: token1Change,
              uniswapPositions: [],
            });
          }}
          max='100'
          maxed={tokenAmount === '100'}
        />
      </div>
    </BaseActionCard>
  );
}