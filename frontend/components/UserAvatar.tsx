'use client';

import React, { useState } from 'react';

export interface UserAvatarProps {
  name: string;
  avatarUrl?: string | null;
  className?: string;
  style?: React.CSSProperties;
  fallbackInitial?: string;
}

export function initials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function UserAvatar({
  name,
  avatarUrl,
  className = 'profile-avatar',
  style,
  fallbackInitial,
}: UserAvatarProps) {
  const [imageError, setImageError] = useState(false);

  const text = fallbackInitial || initials(name);

  if (avatarUrl && !imageError) {
    return (
      <span className={className} style={{ ...style, overflow: 'hidden' }} aria-hidden="true">
        <img
          src={avatarUrl}
          alt={name || 'Avatar'}
          className="avatar-img"
          referrerPolicy="no-referrer"
          onError={() => setImageError(true)}
        />
      </span>
    );
  }

  return (
    <span className={className} style={style} aria-hidden="true">
      {text}
    </span>
  );
}
