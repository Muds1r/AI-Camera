'use client';

import Link from 'next/link';
import { PageFrame, linkMutedClass } from '@/components/page-frame';
import { Card } from '@/components/widgets';

const LINKS = [
  { href: '/admin/hr', label: 'HR accounts', detail: 'Create and manage HR logins' },
  { href: '/admin/logs', label: 'Activity', detail: 'Audit trail of important changes' },
  { href: '/cameras', label: 'Cameras', detail: 'Live camera registry' },
  { href: '/operations', label: 'Operations', detail: 'Detections and alerts' },
] as const;

export default function AdminHome() {
  return (
    <PageFrame title="Administration">
      <Card title="Sections">
        <ul className="divide-line divide-y">
          {LINKS.map((item) => (
            <li key={item.href} className="py-3 first:pt-0 last:pb-0">
              <Link href={item.href} className="group block">
                <span className={`${linkMutedClass} text-sm`}>{item.label}</span>
                <p className="text-mute mt-0.5 text-xs">{item.detail}</p>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </PageFrame>
  );
}
