'use client';

import Link from 'next/link';
import { PageFrame, linkMutedClass } from '@/components/page-frame';
import { Card } from '@/components/widgets';

const LINKS = [
  { href: '/hr/employees', label: 'Employees', detail: 'Accounts, roles, and compensation' },
  { href: '/hr/attendance', label: 'Attendance', detail: 'Team records, holidays, and your clock' },
  {
    href: '/hr/requests',
    label: 'Approvals',
    detail: 'Leave, overtime, attendance, and claims finance filed',
  },
  {
    href: '/hr/announcements',
    label: 'Announcements',
    detail: 'News with a title, photos, and text',
  },
  { href: '/policies', label: 'Policies', detail: 'Company SOPs everyone can read' },
  { href: '/hr/company', label: 'Company', detail: 'Logo, weekends, and leave defaults' },
] as const;

export default function HrHome() {
  return (
    <PageFrame title="HR">
      <Card title="Sections">
        <ul className="divide-line divide-y">
          {LINKS.map((item) => (
            <li key={item.href} className="py-3 first:pt-0 last:pb-0">
              <Link href={item.href} className="block">
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
