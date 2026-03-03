import React, { useState } from 'react';
import { Channel, Topic, SourceChannel, Competitor, Staff } from '../types';
import { Crosshair, Link as LinkIcon, Users, Hash, Search, Plus, Trash2, ExternalLink, RefreshCw, BarChart3, Clock, AlertCircle } from 'lucide-react';
import { usePermissions } from '../hooks/usePermissions';
import { SourceChannels } from './SourceChannels';
import { CompetitorSpy } from './CompetitorSpy';

interface SpyManagerProps {
    sourceChannels: SourceChannel[];
    setSourceChannels: React.Dispatch<React.SetStateAction<SourceChannel[]>>;
    competitors: Competitor[];
    setCompetitors: React.Dispatch<React.SetStateAction<Competitor[]>>;
    topics: Topic[];
    setTopics: React.Dispatch<React.SetStateAction<Topic[]>>;
    channels: Channel[];
    youtubeApiKey: string;
    geminiApiKey?: string;
    rotateYoutubeKey: () => boolean;
    staffList: Staff[];
    currentUser: { id: string; name: string; role: string } | null;
}

export function SpyManager({
    sourceChannels, setSourceChannels,
    competitors, setCompetitors,
    topics, setTopics,
    channels, youtubeApiKey, geminiApiKey, rotateYoutubeKey,
    staffList, currentUser
}: SpyManagerProps) {
    const [activeTab, setActiveTab] = useState<'sources' | 'competitors'>('sources');

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Khám Phá Thị Trường</h1>
                    <p className="text-sm text-gray-500 mt-1">Nghiên cứu kênh nguồn để reup và theo dõi đối thủ cạnh tranh</p>
                </div>
            </div>

            {/* Sub-Navigation Tabs */}
            <div className="flex space-x-2 bg-gray-100 p-1.5 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('sources')}
                    className={`flex items-center px-5 py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm ${activeTab === 'sources'
                            ? 'bg-white text-blue-600 ring-1 ring-blue-100'
                            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                        }`}
                >
                    <LinkIcon size={18} className="mr-2" />
                    Kênh Nguồn (Reup / Idea)
                    <span className="ml-2 bg-blue-100 text-blue-700 py-0.5 px-2 rounded-full text-[10px]">{sourceChannels.length}</span>
                </button>
                <button
                    onClick={() => setActiveTab('competitors')}
                    className={`flex items-center px-5 py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm ${activeTab === 'competitors'
                            ? 'bg-white text-indigo-600 ring-1 ring-indigo-100'
                            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                        }`}
                >
                    <Crosshair size={18} className="mr-2" />
                    Spy Đối Thủ
                    <span className="ml-2 bg-indigo-100 text-indigo-700 py-0.5 px-2 rounded-full text-[10px]">{competitors.length}</span>
                </button>
            </div>

            <div className="mt-4">
                {activeTab === 'sources' ? (
                    <SourceChannels
                        sourceChannels={sourceChannels}
                        setSourceChannels={setSourceChannels}
                        topics={topics}
                        setTopics={setTopics}
                        channels={channels}
                        youtubeApiKey={youtubeApiKey}
                        geminiApiKey={geminiApiKey}
                        rotateYoutubeKey={rotateYoutubeKey}
                        staffList={staffList}
                        currentUser={currentUser}
                    />
                ) : (
                    <CompetitorSpy
                        competitors={competitors}
                        setCompetitors={setCompetitors}
                        youtubeApiKey={youtubeApiKey}
                        geminiApiKey={geminiApiKey}
                        rotateYoutubeKey={rotateYoutubeKey}
                        topics={topics}
                    />
                )}
            </div>
        </div>
    );
}
