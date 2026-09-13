// Known frontend routes — shown as a pick-list under any "link"/"redirect"
// field in admin (announcements, carousel CTA) so whoever fills the form
// doesn't have to go dig up exact slugs from the frontend repo.
// Keep in sync with frontend/pages/*.tsx and frontend/lib/serviceCategories.ts.

export interface SiteRoute { path: string; label: string }

export const SITE_ROUTES: SiteRoute[] = [
  { path: '/',                                      label: 'Home' },
  { path: '/services',                              label: 'Services — agent/service picker' },
  { path: '/booking-usha-bhatt',                    label: 'Usha Bhatt — category chooser' },
  { path: '/tarot-reading-services',                label: 'Category: Tarot Reading' },
  { path: '/akashic-mokshapat-pastlife',            label: 'Category: Akashic, Mokshapat & Past Life' },
  { path: '/reiki-crystal-photo-healing',           label: 'Category: Reiki, Crystal & Photo Healing' },
  { path: '/sound-healing-services',                label: 'Category: Sound Healing' },
  { path: '/black-magic-evil-eye-removal',          label: 'Category: Black Magic & Evil Eye Removal' },
  { path: '/crystal-grids',                         label: 'Category: Crystal Grids' },
  { path: '/pendulum-dowsing-gem-stone-counselling', label: 'Category: Pendulum Dowsing & Gemstone Counselling' },
  { path: '/shop',                                  label: 'Shop' },
  { path: '/courses',                               label: 'Courses' },
  { path: '/about',                                 label: 'About' },
  { path: '/videos',                                label: 'Videos' },
  { path: '/blog',                                  label: 'Blog' },
  { path: '/shipping-returns',                      label: 'Shipping & Returns' },
  { path: '/terms-of-use',                          label: 'Terms & Conditions' },
  { path: '/privacy-policy',                        label: 'Privacy Policy' },
  { path: '/disclaimer',                            label: 'Disclaimer' },
]
