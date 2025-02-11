/**
 * Copyright (c) Codice Foundation
 *
 * This is free software: you can redistribute it and/or modify it under the terms of the GNU Lesser
 * General Public License as published by the Free Software Foundation, either version 3 of the
 * License, or any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without
 * even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details. A copy of the GNU Lesser General Public License
 * is distributed along with this program and can be found at
 * <http://www.gnu.org/licenses/lgpl.html>.
 *
 **/
import * as React from 'react'
import LinearProgress, {
  LinearProgressProps,
} from '@material-ui/core/LinearProgress'
import Button, { ButtonProps } from '@material-ui/core/Button'
import CircularProgress, {
  CircularProgressProps,
} from '@material-ui/core/CircularProgress'

type Props = {
  children: React.ReactNode
  style?: React.CSSProperties
  disabled?: boolean
  loading?: boolean
  variant?: ButtonProps['variant']
  color?: ButtonProps['color']
  size?: ButtonProps['size']
  progressVariant?: 'circular' | 'linear'
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  buttonProps?: ButtonProps
  linearProgressProps?: LinearProgressProps
  circularProgressProps?: CircularProgressProps
  className?: string
  dataId?: string
}

const ProgressButton = (props: Props) => {
  const {
    children,
    style,
    disabled,
    loading,
    variant,
    color,
    size,
    progressVariant,
    onClick,
    buttonProps,
    linearProgressProps,
    circularProgressProps,
    className,
    dataId,
  } = props

  const Loading = () => {
    return progressVariant === 'circular' ? (
      <CircularProgress
        size={24}
        className="absolute"
        {...circularProgressProps}
      />
    ) : (
      <LinearProgress
        className="absolute w-full h-full opacity-25"
        {...linearProgressProps}
      />
    )
  }

  return (
    <Button
      data-id={dataId}
      style={style}
      variant={variant || 'contained'}
      color={color || 'primary'}
      size={size}
      className={`relative ${className}`}
      disabled={loading || disabled}
      onClick={onClick}
      {...buttonProps}
    >
      {children}
      {loading && <Loading />}
    </Button>
  )
}

export default ProgressButton
