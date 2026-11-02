import type { ComponentPropsWithRef } from 'react'
import Button from './Button'
import { Tooltip } from '@base-ui/react/tooltip'
import { uiIcons, type UIIcon } from '../../lib/ui-icons'

type Props = Omit<ComponentPropsWithRef<'button'>, 'children'> & {
  icon: UIIcon
  label: string
  intent?: 'default' | 'primary' | 'destructive'
}
export default function IconButton({
  icon,
  label,
  className = '',
  ref,
  ...props
}: Props) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        ref={ref}
        render={<Button {...props} className={`ui-icon-button ${className}`} />}
        aria-label={label}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d={uiIcons[icon]} />
        </svg>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner
          side="top"
          sideOffset={4}
          className="ui-tooltip-positioner"
        >
          <Tooltip.Popup className="ui-tooltip" role="tooltip">
            {label}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}
