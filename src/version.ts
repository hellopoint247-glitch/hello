export interface VersionLog {
  version: string;
  previousVersion: string;
  releaseDate: string;
  title: string;
  changes: string[];
  isCurrent?: boolean;
}

export const APP_CURRENT_VERSION = "v2.5.0";
export const APP_PREVIOUS_VERSION = "v2.4.0";
export const APP_PROPRIETOR_NAME = "Mahbub Hasan";

export const APP_VERSION_HISTORY: VersionLog[] = [
  {
    version: "v2.5.0",
    previousVersion: "v2.4.0",
    releaseDate: "১৪ আগস্ট, ২০২৬",
    title: "ডেক্সটপ মোড ৩ সারি, কাস্টমার ডিলিট ও সব এন্ট্রি ক্লিয়ার আপডেট",
    isCurrent: true,
    changes: [
      "ডেক্সটপ মোডে কন্টেইনার সাইজ আরো প্রশস্ত (max-w-7xl) করা হয়েছে।",
      "কাস্টমার ও পে-বিল তালিকা ২ সারির বদলে ৩ সারিতে (3 Columns Grid) বিন্যস্ত।",
      "কাস্টমার ব্যালেন্স নামের ডানপাশে সাজিয়ে জায়গা সাশ্রয়ী ডিজাইন করা হয়েছে।",
      "কাস্টমার লেনদেন হিস্ট্রিতে ক্রমিক নং (১, ২, ৩...) যুক্ত করা হয়েছে।",
      "কাস্টমার কার্ডের থ্রি-ডট থেকে অপ্রয়োজনীয় বাটন সরিয়ে কাস্টমার ডিলিট ফিচার যুক্ত।",
      "কাস্টমার প্রোফাইলে এক ক্লিকে 'সব এন্ট্রি ক্লিয়ার' করার সুবিধা যুক্ত।"
    ]
  },
  {
    version: "v2.4.0",
    previousVersion: "v2.3.0",
    releaseDate: "১০ আগস্ট, ২০২৬",
    title: "ডেস্কটপ মোড ফিচার ও ইন্টারফেস অপ্টিমাইজেশন",
    changes: [
      "ডেস্কটপ ও ল্যাপটপের জন্য ওয়াইডস্ক্রিন রেসপন্সিভ ভিউ যুক্ত করা হয়েছে।",
      "লক স্ক্রিন ও ড্যাশবোর্ডে দ্রুত নেভিগেশন সুবিধা উন্নত করা হয়েছে।"
    ]
  },
  {
    version: "v2.3.0",
    previousVersion: "v2.2.0",
    releaseDate: "০৫ আগস্ট, ২০২৬",
    title: "বাংলা ক্যালেন্ডার (বার সহ) ও লাইভ নোটিফিকেশন",
    changes: [
      "বাংলা সাল, মাস ও বার সহ বিস্তারিত বাংলা ক্যালেন্ডার যুক্ত।",
      "বকেয়া পরিশোধ তাগাদার জন্য হোয়াটসঅ্যাপ অ্যালার্ট ইন্টিগ্রেশন।"
    ]
  },
  {
    version: "v2.0.0",
    previousVersion: "v1.0.0",
    releaseDate: "০১ আগস্ট, ২০২৬",
    title: "ক্লাউড ফায়ারস্টোর ডাটাবেজ ও মাল্টি-ইউজার সাপোর্ট",
    changes: [
      "ফায়ারস্টোর ক্লাউড সিঙ্ক ও অটোমেটিক ব্যাকআপ ব্যবস্থা।",
      "কাস্টমার পোর্টাল ও ডিজিটাল স্টেটমেন্ট ভিউয়ার।"
    ]
  }
];
