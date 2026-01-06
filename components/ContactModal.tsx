import React, { useState } from 'react';
import { X, Send, CheckCircle, MessageSquare } from 'lucide-react';
import Button from './Button';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialName?: string;
  initialEmail?: string;
}

const ContactModal: React.FC<Props> = ({
  isOpen,
  onClose,
  initialName = '',
  initialEmail = ''
}) => {
  const [formData, setFormData] = useState({
    name: initialName,
    email: initialEmail,
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Safe API URL usage: fallback if env variable is missing
    const API_URL = import.meta.env.VITE_API_URL || 'https://fallback-url.com';
    
    console.log('Sending to:', API_URL);
    console.log('Contact Form Submission:', formData);

    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setFormData({ ...formData, message: '' });
      onClose();
    }, 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden transform scale-100 transition-transform border border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
          <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <MessageSquare size={18} className="text-blue-600 dark:text-blue-400"/> Contact Support
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {submitted ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                <CheckCircle size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Message Sent!</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                Thank you for reaching out.<br/>We will get back to you shortly.
              </p>
              <Button onClick={onClose} variant="outline" className="text-sm">Close</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Your Name</label>
                <input 
                  type="text" 
                  required
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Email Address</label>
                <input 
                  type="email" 
                  required
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Message</label>
                <textarea 
                  required
                  rows={4}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none text-sm"
                  value={formData.message}
                  onChange={e => setFormData({...formData, message: e.target.value})}
                  placeholder="How can we help you today?"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2 py-3 shadow-lg shadow-blue-900/20"
              >
                <Send size={16} /> Send Message
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactModal;
