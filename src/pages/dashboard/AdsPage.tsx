import { ExternalLink, Megaphone, Music2, Instagram, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

const adChannels = [
  {
    name: 'TikTok Ads',
    description: 'Create and manage campaigns that help new audiences discover your products on TikTok.',
    href: 'https://ads.tiktok.com',
    badge: 'TikTok for Business',
    icon: Music2,
    cardClass: 'from-gray-950 to-gray-800',
    buttonClass: 'bg-gray-950 hover:bg-gray-800 text-white',
  },
  {
    name: 'Instagram Ads',
    description: 'Promote your products to potential customers through Instagram placements in Meta Ads Manager.',
    href: 'https://adsmanager.facebook.com',
    badge: 'Meta Ads Manager',
    icon: Instagram,
    cardClass: 'from-purple-700 via-pink-600 to-orange-400',
    buttonClass: 'bg-gradient-to-r from-purple-600 to-pink-500 hover:opacity-90 text-white',
  },
];

export default function AdsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <div>
        <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
          <Megaphone className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ads</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500 dark:text-gray-400">
          Manage your social advertising destinations from one place. Choose a platform below to open its official ads manager.
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {adChannels.map((channel, index) => {
          const Icon = channel.icon;
          return (
            <motion.section
              key={channel.name}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
            >
              <div className={`bg-gradient-to-br ${channel.cardClass} p-6 text-white`}>
                <div className="flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15">
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">{channel.badge}</span>
                </div>
                <h2 className="mt-7 text-xl font-bold">{channel.name}</h2>
                <p className="mt-2 min-h-12 max-w-md text-sm leading-6 text-white/85">{channel.description}</p>
              </div>
              <div className="space-y-4 p-6">
                <div className="flex items-start gap-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                  You’ll continue on the platform’s official website. Campaigns and billing are managed there.
                </div>
                <a href={channel.href} target="_blank" rel="noopener noreferrer"
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-opacity ${channel.buttonClass}`}>
                  Open {channel.name}
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </motion.section>
          );
        })}
      </div>
    </div>
  );
}
