/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShieldCheck, FileText, RotateCcw, X, Lock, CheckCircle2, Phone } from 'lucide-react';

export type PolicyTabType = 'privacy' | 'terms' | 'refund';

interface ShopPoliciesModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: PolicyTabType;
  setActiveTab: (tab: PolicyTabType) => void;
  lang: 'bn' | 'en';
}

export function ShopPoliciesModal({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
  lang
}: ShopPoliciesModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-[100020] flex items-center justify-center p-3 sm:p-5 animate-fade-in font-sans select-none">
      <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200 text-left">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black leading-tight">
                {lang === 'bn' ? 'হ্যালো পয়েন্ট অনলাইন শপ নীতিমালা' : 'HelloPoint Online Shop Policies'}
              </h3>
              <p className="text-[11px] font-medium text-slate-300">
                {lang === 'bn'
                  ? 'নিরাপদ কেনাকাটা ও ডিজিটাল পেমেন্ট গেটওয়ে নীতিমালা'
                  : 'Official Privacy Policy, Terms & Conditions, and Refund Policy'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Policy Selector Tabs */}
        <div className="bg-slate-100 px-4 pt-3 border-b border-slate-200 flex items-center gap-2 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-black flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'privacy'
                ? 'bg-white text-slate-900 border-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-emerald-600" />
            <span>{lang === 'bn' ? 'প্রাইভেসি পলিসি (Privacy Policy)' : 'Privacy Policy'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('terms')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-black flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'terms'
                ? 'bg-white text-slate-900 border-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-blue-600" />
            <span>{lang === 'bn' ? 'টার্মস অ্যান্ড কন্ডিশনস (Terms & Conditions)' : 'Terms & Conditions'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('refund')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-black flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'refund'
                ? 'bg-white text-slate-900 border-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
            <span>{lang === 'bn' ? 'রিফান্ড ও রিটার্ন পলিসি (Refund & Return)' : 'Refund & Return Policy'}</span>
          </button>
        </div>

        {/* Policy Body Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-slate-700 text-xs sm:text-sm leading-relaxed select-text">
          {activeTab === 'privacy' && (
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-3">
                <h4 className="text-base sm:text-lg font-black text-slate-900">
                  {lang === 'bn' ? 'প্রাইভেসি পলিসি (গোপনীয়তা নীতি)' : 'Privacy Policy'}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {lang === 'bn' ? 'কার্যকর তারিখ: জানুয়ারি ২০২৬ | HelloPoint Online Shop' : 'Effective Date: January 2026 | HelloPoint Online Shop'}
                </p>
              </div>

              <p>
                {lang === 'bn'
                  ? 'HelloPoint অনলাইন শপে আপনাকে স্বাগতম। আমাদের কাস্টমারদের ব্যক্তিগত তথ্যের নিরাপত্তা ও গোপনীয়তা রক্ষা করা আমাদের সর্বোচ্চ অগ্রাধিকার। আপনি যখন আমাদের ওয়েবসাইট থেকে একাউন্ট তৈরি করেন বা পণ্য অর্ডার করেন, তখন আপনার তথ্য কীভাবে সংগ্রহ, ব্যবহার এবং সুরক্ষিত রাখা হয় তা নিচে স্পষ্টভাবে উল্লেখ করা হলো:'
                  : 'Welcome to HelloPoint Online Shop. Protecting the privacy and security of our customers’ personal data is our highest priority. Below is a clear explanation of how we collect, use, and safeguard your information when you create an account or place an order:'}
              </p>

              <div className="space-y-3">
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                  <h5 className="font-black text-slate-900 mb-1">
                    {lang === 'bn' ? '১. আমরা কী কী তথ্য সংগ্রহ করি' : '1. Information We Collect'}
                  </h5>
                  <p className="text-xs sm:text-sm text-slate-600">
                    {lang === 'bn'
                      ? 'কাস্টমার একাউন্ট খোলা এবং অর্ডার প্রসেসিংয়ের জন্য আমরা আপনার নাম, মোবাইল নাম্বার, সম্পূর্ণ ডেলিভারি ঠিকানা এবং অর্ডার ও পেমেন্ট সংক্রান্ত লেনদেনের বিবরণ সংগ্রহ করি।'
                      : 'To register your customer account and fulfill orders, we collect your full name, mobile phone number, complete delivery address, and order/payment transaction history.'}
                  </p>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                  <h5 className="font-black text-slate-900 mb-1">
                    {lang === 'bn' ? '২. তথ্যের ব্যবহার' : '2. How We Use Your Information'}
                  </h5>
                  <p className="text-xs sm:text-sm text-slate-600">
                    {lang === 'bn'
                      ? 'আপনার প্রদত্ত তথ্য শুধুমাত্র আপনার অর্ডার কনফার্ম করা, সঠিক ঠিকানায় পণ্য ডেলিভারি পৌঁছে দেওয়া, অর্ডার সংক্রান্ত আপডেট বা কাস্টমার সাপোর্ট প্রদান এবং ভবিষ্যতে দ্রুত অর্ডার করার সুবিধার্থে ব্যবহৃত হয়।'
                      : 'Your information is strictly used to confirm orders, deliver products to your address, provide order updates and customer support, and streamline future checkouts.'}
                  </p>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                  <h5 className="font-black text-slate-900 mb-1">
                    {lang === 'bn' ? '৩. অনলাইন পেমেন্ট ও ডাটা নিরাপত্তা' : '3. Online Payment & Data Security'}
                  </h5>
                  <p className="text-xs sm:text-sm text-slate-600">
                    {lang === 'bn'
                      ? 'আমাদের ওয়েবসাইটে অনলাইন পেমেন্ট গেটওয়ে (যেমন: bKash, Nagad, Rocket, SSLCommerz বা ব্যাংক কার্ড) ব্যবহারের ক্ষেত্রে সকল লেনদেন নিরাপদ SSL এনক্রিপশনের মাধ্যমে সম্পন্ন হয়। আমরা কাস্টমারের কোনো গোপন পিন, পাসওয়ার্ড বা কার্ডের সিভিভি (CVV) তথ্য আমাদের সার্ভারে সংরক্ষণ করি না।'
                      : 'When using online payment gateways (such as bKash, Nagad, Rocket, SSLCommerz, or cards), all transactions are processed over encrypted SSL channels. We never store your sensitive payment PINs or card CVV numbers.'}
                  </p>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                  <h5 className="font-black text-slate-900 mb-1">
                    {lang === 'bn' ? '৪. তৃতীয় পক্ষের সাথে তথ্য আদান-প্রদান' : '4. Third-Party Sharing'}
                  </h5>
                  <p className="text-xs sm:text-sm text-slate-600">
                    {lang === 'bn'
                      ? 'পণ্য ডেলিভারি সম্পন্ন করার জন্য অনুমোদিত কুরিয়ার সার্ভিস এবং পেমেন্ট যাচাইয়ের জন্য পেমেন্ট গেটওয়ে ব্যতীত আমরা কোনো তৃতীয় পক্ষের কাছে গ্রাহকের ব্যক্তিগত তথ্য বিক্রি বা হস্তান্তর করি না।'
                      : 'We never sell or rent customer data to third parties. Data is shared only with authorized delivery couriers for shipping and licensed payment gateways for payment verification.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'terms' && (
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-3">
                <h4 className="text-base sm:text-lg font-black text-slate-900">
                  {lang === 'bn' ? 'টার্মস অ্যান্ড কন্ডিশনস (ব্যবহারের শর্তাবলী)' : 'Terms & Conditions'}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {lang === 'bn' ? 'HelloPoint Online Shop ই-কমার্স নীতিমালা' : 'HelloPoint E-Commerce Terms of Service'}
                </p>
              </div>

              <p>
                {lang === 'bn'
                  ? 'HelloPoint অনলাইন শপ ব্যবহার করে কেনাকাটা ও অর্ডার করার পূর্বে অনুগ্রহ করে নিচের শর্তাবলী মনোযোগ সহকারে পড়ুন। আমাদের ওয়েবসাইটে অর্ডার কনফার্ম করার অর্থ হলো আপনি এই শর্তাবলীতে সম্মতি প্রদান করছেন:'
                  : 'Please read these Terms & Conditions carefully before registering an account or placing an order at HelloPoint Online Shop:'}
              </p>

              <div className="space-y-3">
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                  <h5 className="font-black text-slate-900 mb-1">
                    {lang === 'bn' ? '১. কাস্টমার একাউন্ট ও লগইন নীতি' : '1. Customer Account & Login Policy'}
                  </h5>
                  <p className="text-xs sm:text-sm text-slate-600">
                    {lang === 'bn'
                      ? 'কাস্টমার তার সঠিক নাম, ১১ ডিজিটের সচল মোবাইল নাম্বার এবং সম্পূর্ণ ঠিকানা দিয়ে একাউন্ট খুলতে পারবেন। পরবর্তীতে লগইন করার সময় কাস্টমারের "নাম" ইউজারনেম হিসেবে এবং "মোবাইল নাম্বার" (অথবা নাম) পাসওয়ার্ড হিসেবে কাজ করবে। একাউন্টে সঠিক তথ্য প্রদান করা কাস্টমারের দায়িত্ব।'
                      : 'Customers can register an account using their full name, active 11-digit mobile number, and delivery address. For returning customers, your Name serves as the Username and your Mobile Number (or Name) serves as the Password.'}
                  </p>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                  <h5 className="font-black text-slate-900 mb-1">
                    {lang === 'bn' ? '২. পণ্যের মূল্য ও স্টক প্রাপ্যতা' : '2. Product Pricing & Stock Availability'}
                  </h5>
                  <p className="text-xs sm:text-sm text-slate-600">
                    {lang === 'bn'
                      ? 'ওয়েবসাইটে প্রতিটি পণ্যের বর্তমান বিক্রয় মূল্য এবং কত পিস স্টকে আছে তা স্পষ্টভাবে প্রদর্শিত থাকে। স্টকে থাকা সাপেক্ষে কাস্টমার পণ্য কার্টে যোগ করে অর্ডার কনফার্ম করতে পারবেন।'
                      : 'All product prices and available stock quantities (in pieces) are clearly displayed on the storefront. Orders are processed subject to available stock.'}
                  </p>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                  <h5 className="font-black text-slate-900 mb-1">
                    {lang === 'bn' ? '৩. অর্ডার কনফার্মেশন ও ডেলিভারি' : '3. Order Confirmation & Delivery'}
                  </h5>
                  <p className="text-xs sm:text-sm text-slate-600">
                    {lang === 'bn'
                      ? 'অর্ডার সাবমিট করার পর আমাদের টিম প্রয়োজনে ফোনে অর্ডারটি ভেরিফাই করে দ্রুততম সময়ে (সাধারণত ২৪ থেকে ৭২ ঘণ্টার মধ্যে) নির্ধারিত ঠিকানায় ডেলিভারির ব্যবস্থা করবে। ভুল ঠিকানা বা ফোন রিসিভ না করার কারণে ডেলিভারি বিলম্বিত হলে কর্তৃপক্ষ দায়ী থাকবে না।'
                      : 'Once an order is confirmed, our team may verify via phone and dispatch the shipment within 24–72 hours to the provided delivery address.'}
                  </p>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                  <h5 className="font-black text-slate-900 mb-1">
                    {lang === 'bn' ? '৪. পেমেন্ট পদ্ধতি' : '4. Payment Terms'}
                  </h5>
                  <p className="text-xs sm:text-sm text-slate-600">
                    {lang === 'bn'
                      ? 'কাস্টমার ক্যাশ অন ডেলিভারি (পণ্য হাতে পেয়ে মূল্য পরিশোধ) অথবা অনুমোদিত ডিজিটাল পেমেন্ট গেটওয়ে (বিকাশ, নগদ বা অনলাইন পেমেন্ট) মাধ্যমে মূল্য পরিশোধ করতে পারবেন।'
                      : 'Customers may pay via Cash on Delivery (COD) upon receiving the product or through authorized digital payment methods (bKash, Nagad, or online payment gateway).'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'refund' && (
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-3">
                <h4 className="text-base sm:text-lg font-black text-slate-900">
                  {lang === 'bn' ? 'রিফান্ড ও রিটার্ন পলিসি (পণ্য ফেরত ও মূল্য ফেরত নীতি)' : 'Refund & Return Policy'}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {lang === 'bn' ? '৭ দিনের সহজ রিটার্ন ও শতভাগ নিরাপদ রিফান্ড গ্যারান্টি' : '7-Day Easy Return & Transparent Refund Policy'}
                </p>
              </div>

              <p>
                {lang === 'bn'
                  ? 'HelloPoint অনলাইন শপে আমরা গ্রাহকদের ১০০% অরিজিনাল ও মানসম্মত পণ্য প্রদানে প্রতিশ্রুতিবদ্ধ। কোনো কারণে পণ্যে ত্রুটি থাকলে আমাদের রিটার্ন ও রিফান্ড পলিসি নিচে বর্ণিত নিয়মে কার্যকর হবে:'
                  : 'At HelloPoint Online Shop, we stand behind the quality of every item we sell. If there is an issue with your order, our Return & Refund Policy applies as follows:'}
              </p>

              <div className="space-y-3">
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                  <h5 className="font-black text-slate-900 mb-1">
                    {lang === 'bn' ? '১. পণ্য রিটার্ন বা পরিবর্তনের শর্তাবলী (৭ দিন)' : '1. Eligibility for Return or Replacement (7 Days)'}
                  </h5>
                  <p className="text-xs sm:text-sm text-slate-600">
                    {lang === 'bn'
                      ? 'পণ্য হাতে পাওয়ার ৭ (সাত) দিনের মধ্যে যদি দেখা যায় পণ্যটি ভাঙা, ক্ষতিগ্রস্ত, কারিগরিভাবে ত্রুটিপূর্ণ (Defective), অথবা অর্ডারকৃত পণ্যের পরিবর্তে ভুল পণ্য এসেছে, তবে কাস্টমার বিনামূল্যে পণ্যটি রিটার্ন বা পরিবর্তন (Replacement) করতে পারবেন।'
                      : 'Within 7 days of receiving the delivery, if a product is damaged, defective, or incorrect compared to what was ordered, you are eligible for a free replacement or full return.'}
                  </p>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                  <h5 className="font-black text-slate-900 mb-1">
                    {lang === 'bn' ? '২. রিটার্ন করার নিয়ম ও প্রমাণাদি' : '2. Return Condition & Packaging'}
                  </h5>
                  <p className="text-xs sm:text-sm text-slate-600">
                    {lang === 'bn'
                      ? 'ডেলিভারি ম্যানের সামনে পণ্য চেক করে নেওয়া উত্তম। এছাড়া পার্সেল খোলার সময় আনবক্সিং ভিডিও ধারণ করার অনুরোধ করা হলো। রিটার্ন করার সময় পণ্যের মূল বক্স, ক্যাশ মেমো এবং সকল অ্যাক্সেসরিজ অক্ষত অবস্থায় থাকতে হবে।'
                      : 'Please inspect the package upon delivery and keep the original box, accessories, and invoice intact when requesting a return or exchange.'}
                  </p>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                  <h5 className="font-black text-slate-900 mb-1">
                    {lang === 'bn' ? '৩. যেসব ক্ষেত্রে রিটার্ন প্রযোজ্য নয়' : '3. Non-Returnable Situations'}
                  </h5>
                  <p className="text-xs sm:text-sm text-slate-600">
                    {lang === 'bn'
                      ? 'গ্রাহকের অসতর্ক ব্যবহারের কারণে পণ্য পুড়ে গেলে, ভেঙে গেলে, পানিতে ভিজলে বা মূল প্যাকেজিং নষ্ট হলে রিটার্ন বা ওয়ারেন্টি প্রযোজ্য হবে না।'
                      : 'Products damaged due to customer misuse, physical breakage after delivery, water damage, or missing original serial/packaging are not eligible for return.'}
                  </p>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                  <h5 className="font-black text-slate-900 mb-1">
                    {lang === 'bn' ? '৪. রিফান্ড (মূল্য ফেরত) সময়সীমা' : '4. Refund Processing Timeline (5–7 Working Days)'}
                  </h5>
                  <p className="text-xs sm:text-sm text-slate-600">
                    {lang === 'bn'
                      ? 'রিটার্নকৃত পণ্য আমাদের কাছে পৌঁছানোর পর যাচাই সাপেক্ষে যদি রিপ্লেসমেন্ট পণ্য স্টকে না থাকে অথবা গ্রাহক রিফান্ড চান, তবে ৫ থেকে ৭ কার্যদিবসের (5–7 Working Days) মধ্যে গ্রাহকের বিকাশ, নগদ বা যে পেমেন্ট মাধ্যমে টাকা পরিশোধ করা হয়েছিল সেই মাধ্যমে সম্পূর্ণ অর্থ রিফান্ড করা হবে।'
                      : 'Once the returned item is received and inspected, if a replacement is unavailable or a refund is requested, the full amount will be refunded within 5 to 7 working days via bKash, Nagad, or the original payment method.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Support Contact Box inside Policy Modal */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xs font-black text-slate-900">
                  {lang === 'bn' ? 'হেল্পলাইন ও কাস্টমার সাপোর্ট' : 'Customer Support & Helpline'}
                </p>
                <p className="text-[11px] font-semibold text-slate-600">
                  {lang === 'bn'
                    ? 'যেকোনো অভিযোগ, রিটার্ন বা তথ্যের জন্য সরাসরি যোগাযোগ করুন'
                    : 'Contact us directly for any order, return, or refund assistance'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono font-black text-emerald-900 bg-white px-3 py-1.5 rounded-xl border border-emerald-200">
              <Phone className="w-3.5 h-3.5 text-emerald-600" />
              <span>01783586858</span>
            </div>
          </div>
        </div>

        {/* Footer Button */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl transition-colors cursor-pointer"
          >
            {lang === 'bn' ? 'বুঝতে পেরেছি / বন্ধ করুন' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
