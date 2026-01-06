import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

interface Comment {
  id: number;
  author: string;
  text: string;
  created_at: string;
}

interface Note {
  id: number;
  book: string;
  content: string;
  likes: number;
  user_id: string;
  user_name: string;
  wechat_id?: string;
  avatar_url?: string;
  created_at: string;
}

export default function App() {
  const [notes, setNotes] = useState<(Note & { comments: Comment[] })[]>([]);
  const [userNotes, setUserNotes] = useState<(Note & { comments: Comment[] })[]>([]);
  const [book, setBook] = useState('');
  const [content, setContent] = useState('');
  const [wechatId, setWechatId] = useState('');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [showAuth, setShowAuth] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserName, setSelectedUserName] = useState<string>('');
  const [selectedWechatId, setSelectedWechatId] = useState<string>('');
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState<string>('');
  const [sortMode, setSortMode] = useState<'latest' | 'hot'>('latest'); // 新增：排序模式

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    fetchNotes();

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  const fetchNotes = async () => {
    setLoading(true);
    let query = supabase
      .from('notes')
      .select('*');

    if (sortMode === 'hot') {
      query = query.order('likes', { ascending: false }).order('created_at', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data: notesData } = await query;

    const notesWithComments = await Promise.all(
      (notesData || []).map(async (note: any) => {
        const { data: comments } = await supabase
          .from('comments')
          .select('*')
          .eq('note_id', note.id)
          .order('created_at', { ascending: false });
        return { 
          ...note, 
          user_name: note.user_name || '匿名读者',
          avatar_url: note.avatar_url || '',
          comments: comments || [] 
        };
      })
    );
    setNotes(notesWithComments);
    setLoading(false);
  };

  // 每次切换排序模式时重新加载
  useEffect(() => {
    if (!selectedUserId) {
      fetchNotes();
    }
  }, [sortMode]);

  const fetchUserNotes = async (userId: string, userName: string, wechatId?: string, avatarUrl?: string) => {
    setLoading(true);
    const { data: notesData } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }); // 个人主页固定按时间

    const notesWithComments = await Promise.all(
      (notesData || []).map(async (note: any) => {
        const { data: comments } = await supabase
          .from('comments')
          .select('*')
          .eq('note_id', note.id)
          .order('created_at', { ascending: false });
        return { 
          ...note, 
          user_name: note.user_name || '匿名读者',
          avatar_url: note.avatar_url || '',
          comments: comments || [] 
        };
      })
    );
    setUserNotes(notesWithComments);
    setSelectedUserId(userId);
    setSelectedUserName(userName);
    setSelectedWechatId(wechatId || '');
    setSelectedAvatarUrl(avatarUrl || '');
    setLoading(false);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    let error;
    if (authMode === 'signup') {
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      error = signUpError;
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      error = signInError;
    }
    if (error) {
      alert(error.message);
    } else {
      setEmail('');
      setPassword('');
      setShowAuth(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSelectedUserId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert('请先登录后再发布笔记');
      setShowAuth(true);
      return;
    }
    if (!book.trim() || !content.trim()) return;

    await supabase.from('notes').insert({
      book,
      content,
      likes: 0,
      user_id: user.id,
      user_name: user.user_metadata?.full_name || user.email?.split('@')[0] || '书友',
      wechat_id: wechatId.trim() || null,
      avatar_url: selectedUserId === user.id ? selectedAvatarUrl : undefined
    });
    setBook('');
    setContent('');
    setWechatId('');
    fetchNotes();
  };

  // 上传头像（保持不变）
  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !user) return;

    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${user.id}/avatar.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      alert('上传失败: ' + uploadError.message);
      console.error(uploadError);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    const { error: updateError } = await supabase
      .from('notes')
      .update({ avatar_url: publicUrl })
      .eq('user_id', user.id);

    if (updateError) {
      alert('更新头像 URL 失败: ' + updateError.message);
      console.error(updateError);
      return;
    }

    setSelectedAvatarUrl(publicUrl);
    alert('头像上传成功！');
    fetchUserNotes(user.id, selectedUserName || user.email?.split('@')[0] || '书友', selectedWechatId, publicUrl);
    fetchNotes();
  };

  const handleLike = async (id: number, currentLikes: number) => {
    await supabase.from('notes').update({ likes: currentLikes + 1 }).eq('id', id);
    selectedUserId ? fetchUserNotes(selectedUserId, selectedUserName, selectedWechatId, selectedAvatarUrl) : fetchNotes();
  };

  const addComment = async (noteId: number, author: string, text: string) => {
    if (!text.trim()) return;
    await supabase.from('comments').insert({
      note_id: noteId,
      author: author.trim() || (user ? (user.email?.split('@')[0] || '书友') : '匿名读者'),
      text: text.trim(),
    });
    selectedUserId ? fetchUserNotes(selectedUserId, selectedUserName, selectedWechatId, selectedAvatarUrl) : fetchNotes();
  };

  const goHome = () => {
    setSelectedUserId(null);
    setSelectedUserName('');
    setSelectedWechatId('');
    setSelectedAvatarUrl('');
    setSortMode('latest'); // 返回首页默认最新
    fetchNotes();
  };

  const currentNotes = selectedUserId ? userNotes : notes;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          {selectedUserId ? (
            <div className="flex items-center gap-4">
              <button onClick={goHome} className="text-blue-600 hover:underline">← 返回首页</button>
              <h1 className="text-3xl font-bold text-gray-800">{selectedUserName} 的笔记</h1>
            </div>
          ) : (
            <div className="flex items-center gap-6">
              <h1 className="text-3xl font-bold text-gray-800">读书笔记分享</h1>
              <div className="flex gap-2 bg-gray-200 p-1 rounded-lg">
                <button
                  onClick={() => setSortMode('latest')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition ${sortMode === 'latest' ? 'bg-white shadow' : 'text-gray-600'}`}
                >
                  最新
                </button>
                <button
                  onClick={() => setSortMode('hot')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition ${sortMode === 'hot' ? 'bg-white shadow' : 'text-gray-600'}`}
                >
                  最热 🔥
                </button>
              </div>
            </div>
          )}
          {user ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">欢迎，{user.email?.split('@')[0]}</span>
              <button onClick={handleSignOut} className="text-sm text-red-600 hover:underline">
                退出登录
              </button>
            </div>
          ) : (
            <button onClick={() => setShowAuth(true)} className="text-blue-600 hover:underline">
              登录 / 注册
            </button>
          )}
        </div>

        {/* 个人主页头部（保持不变） */}
        {selectedUserId && (
          <div className="bg-white p-6 rounded-lg shadow mb-8 text-center">
            <div className="flex flex-col items-center">
              <img 
                src={selectedAvatarUrl || 'https://via.placeholder.com/120?text=头像'} 
                alt="头像"
                className="w-32 h-32 rounded-full object-cover mb-4 border-4 border-gray-200"
              />
              {user && selectedUserId === user.id && (
                <label className="cursor-pointer bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700">
                  上传新头像
                  <input type="file" accept="image/*" onChange={uploadAvatar} className="hidden" />
                </label>
              )}
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mt-4">{selectedUserName}</h2>
            {selectedWechatId ? (
              <div className="text-lg text-green-600 font-medium mt-2">
                微信: {selectedWechatId}（可复制添加）
              </div>
            ) : (
              <div className="text-gray-500 mt-2">暂未公开微信号</div>
            )}
            <p className="text-sm text-gray-500 mt-2">共 {userNotes.length} 条笔记</p>
          </div>
        )}

        {/* 登录弹窗、发布表单、笔记列表保持不变 */}
        {showAuth && !user && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-lg shadow-xl max-w-sm w-full">
              <h2 className="text-2xl font-bold mb-4 text-center">{authMode === 'login' ? '登录' : '注册'}</h2>
              <form onSubmit={handleAuth}>
                <input type="email" placeholder="邮箱" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-2 border rounded mb-4" required />
                <input type="password" placeholder="密码" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-2 border rounded mb-4" required />
                <div className="flex gap-4 mb-4">
                  <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
                    {authMode === 'login' ? '登录' : '注册'}
                  </button>
                  <button type="button" onClick={() => setShowAuth(false)} className="flex-1 bg-gray-300 py-2 rounded">
                    取消
                  </button>
                </div>
              </form>
              <p className="text-center text-sm">
                {authMode === 'login' ? '没有账号？' : '已有账号？'}
                <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="text-blue-600 hover:underline ml-1">
                  {authMode === 'login' ? '去注册' : '去登录'}
                </button>
              </p>
            </div>
          </div>
        )}

        {!selectedUserId && (
          <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow mb-8">
            <input type="text" placeholder="书名" value={book} onChange={e => setBook(e.target.value)} className="w-full px-4 py-2 border rounded mb-4 focus:outline-none focus:border-blue-500" required />
            <textarea placeholder={user ? "写下你的读书笔记..." : "请先登录后再发布笔记"} value={content} onChange={e => setContent(e.target.value)} rows={4} className="w-full px-4 py-2 border rounded mb-4 focus:outline-none focus:border-blue-500" required disabled={!user} />
            <input type="text" placeholder="你的微信号（可选，方便书友加你）" value={wechatId} onChange={e => setWechatId(e.target.value)} className="w-full px-4 py-2 border rounded mb-4 focus:outline-none focus:border-green-500 text-green-700 placeholder-green-400" />
            <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700" disabled={!user}>
              发布笔记
            </button>
          </form>
        )}

        {loading ? (
          <p className="text-center text-gray-500">加载中...</p>
        ) : currentNotes.length === 0 ? (
          <p className="text-center text-gray-500">暂无笔记</p>
        ) : (
          currentNotes.map(note => (
            <div key={note.id} className="bg-white p-6 rounded-lg shadow mb-6">
              <div className="flex items-start gap-4 mb-2">
                <img 
                  src={note.avatar_url || 'https://via.placeholder.com/60?text=头像'} 
                  alt="头像"
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h3 className="text-xl font-semibold text-gray-800">{note.book}</h3>
                  </div>
                  <div className="text-sm text-gray-500">
                    <button
                      onClick={() => fetchUserNotes(note.user_id, note.user_name, note.wechat_id, note.avatar_url)}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {note.user_name}
                    </button>
                    {note.wechat_id && (
                      <span className="text-green-600 font-medium ml-2">
                        微信: {note.wechat_id}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-gray-700 mb-4 ml-16 whitespace-pre-wrap">{note.content}</p>
              <div className="flex items-center gap-4 mb-4 ml-16">
                <button onClick={() => handleLike(note.id, note.likes)}
                  className="flex items-center gap-1 text-red-500 hover:text-red-600">
                  ❤️ {note.likes}
                </button>
                <span className="text-sm text-gray-500">
                  {new Date(note.created_at).toLocaleString('zh-CN')}
                </span>
              </div>

              <div className="border-t pt-4 ml-16">
                <CommentForm noteId={note.id} onComment={selectedUserId ? () => fetchUserNotes(selectedUserId, selectedUserName, selectedWechatId, selectedAvatarUrl) : fetchNotes} user={user} />
                {note.comments.map(c => (
                  <div key={c.id} className="mt-3 pl-4 border-l-2 border-gray-200">
                    <p className="text-sm font-medium">{c.author}</p>
                    <p className="text-gray-700">{c.text}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(c.created_at).toLocaleString('zh-CN')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CommentForm({ noteId, onComment, user }: { noteId: number; onComment: () => void; user: any }) {
  const [author, setAuthor] = useState('');
  const [text, setText] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    await supabase.from('comments').insert({
      note_id: noteId,
      author: author.trim() || (user ? (user.email?.split('@')[0] || '书友') : '匿名读者'),
      text: text.trim(),
    });
    setAuthor('');
    setText('');
    onComment();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 mb-4">
      {!user && (
        <input type="text" placeholder="你的名字（可留空）" value={author} onChange={e => setAuthor(e.target.value)} className="px-3 py-1 border rounded text-sm" />
      )}
      <div className="flex gap-2">
        <input type="text" placeholder="说点什么..." value={text} onChange={e => setText(e.target.value)} className="flex-1 px-3 py-1 border rounded text-sm" />
        <button type="submit" className="px-4 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm">
          评论
        </button>
      </div>
    </form>
  );
}
