import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Tag, Modal, message, Input, Select, Form, Card, Typography, Popconfirm, Checkbox } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, KeyOutlined, CopyOutlined, ReloadOutlined, LockOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { usePermissions } from '../contexts/PermissionContext';

const { Text } = Typography;

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  api_token?: string;
  token_expires_at?: string;
  token_permissions?: string;
}

interface ApiCategory {
  id: number;
  name: string;
  code: string;
  description: string;
  sort_order: number;
  status: string;
}

const UserList: React.FC = () => {
  const { hasPermission } = usePermissions();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState({ role: '', status: '', search: '' });
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm] = Form.useForm();
  const [tokenModalVisible, setTokenModalVisible] = useState(false);
  const [tokenUser, setTokenUser] = useState<User | null>(null);
  const [tokenForm] = Form.useForm();
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [passwordUser, setPasswordUser] = useState<User | null>(null);
  const [passwordForm] = Form.useForm();
  const [currentUser, setCurrentUser] = useState<{ id: number; role: string } | null>(null);
  const [publishedApis, setPublishedApis] = useState<any[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedApis, setSelectedApis] = useState<number[]>([]);
  const [categoryApis, setCategoryApis] = useState<Record<string, any[]>>({});
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchCurrentUser();
    fetchCategories();
  }, [pagination.current, pagination.pageSize, filters]);

  const fetchCategories = async () => {
    setCategoriesLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/system/categories', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentUser({ id: data.id, role: data.role });
      }
    } catch (error) {
      console.error('Failed to fetch current user:', error);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: pagination.current.toString(),
        limit: pagination.pageSize.toString()
      });

      if (filters.role) params.append('role', filters.role);
      if (filters.status) params.append('status', filters.status);
      if (filters.search) params.append('search', filters.search);

      const response = await fetch(`/api/users?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.data);
        setPagination(prev => ({ ...prev, total: data.pagination.total }));
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
      message.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchPublishedApis = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/apis?status=published&limit=3000', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const apis = data.data || [];
        setPublishedApis(apis);
        
        const grouped: Record<string, any[]> = {};
        apis.forEach((api: any) => {
          const category = api.category || 'default';
          if (!grouped[category]) {
            grouped[category] = [];
          }
          grouped[category].push(api);
        });
        setCategoryApis(grouped);
      }
    } catch (error) {
      console.error('Failed to fetch published APIs:', error);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        message.success('删除成功');
        fetchUsers();
      } else {
        message.error('删除失败');
      }
    } catch (error) {
      console.error('Delete error:', error);
      message.error('删除失败');
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    editForm.setFieldsValue({
      email: user.email,
      role: user.role,
      status: user.status
    });
    setEditModalVisible(true);
  };

  const handleEditSubmit = async () => {
    try {
      const values = await editForm.validateFields();
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/users/${editingUser?.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(values)
      });

      if (response.ok) {
        message.success('更新成功');
        setEditModalVisible(false);
        fetchUsers();
      } else {
        message.error('更新失败');
      }
    } catch (error) {
      console.error('Update error:', error);
      message.error('更新失败');
    }
  };

  const handleTokenManage = async (user: User) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/users/${user.id}/token`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTokenUser({ ...user, ...data });
        
        await fetchPublishedApis();
        
        let permissions = 'all';
        let categories: string[] = [];
        let apis: number[] = [];
        
        if (data.token_permissions) {
          try {
            const parsed = typeof data.token_permissions === 'string' 
              ? JSON.parse(data.token_permissions) 
              : data.token_permissions;
            
            if (parsed.type === 'categories') {
              permissions = 'categories';
              categories = parsed.categories || [];
              apis = parsed.apis || [];
            } else {
              permissions = parsed.type || 'all';
            }
          } catch (e) {
            permissions = data.token_permissions;
          }
        }
        
        tokenForm.setFieldsValue({
          expires_in_days: 30,
          permissions: permissions
        });
        setSelectedCategories(categories);
        setSelectedApis(apis);
        setTokenModalVisible(true);
      } else {
        message.error('获取token信息失败');
      }
    } catch (error) {
      console.error('Get token error:', error);
      message.error('获取token信息失败');
    }
  };

  const handleGenerateToken = async () => {
    try {
      const values = await tokenForm.validateFields();
      const token = localStorage.getItem('token');
      
      let permissions = values.permissions;
      
      if (values.permissions === 'categories') {
        permissions = JSON.stringify({
          type: 'categories',
          categories: selectedCategories,
          apis: selectedApis
        });
      } else if (values.permissions === 'all') {
        permissions = 'all';
      } else if (values.permissions === 'read_only') {
        permissions = JSON.stringify({
          type: 'read_only'
        });
      }
      
      const response = await fetch(`/api/users/${tokenUser?.id}/token`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          expires_in_days: values.expires_in_days,
          permissions: permissions
        })
      });

      if (response.ok) {
        const data = await response.json();
        message.success('Token生成成功');
        setTokenUser({ ...tokenUser!, ...data });
      } else {
        message.error('Token生成失败');
      }
    } catch (error) {
      console.error('Generate token error:', error);
      message.error('Token生成失败');
    }
  };

  const handleCopyToken = () => {
    if (tokenUser?.api_token) {
      navigator.clipboard.writeText(tokenUser.api_token);
      message.success('Token已复制到剪贴板');
    }
  };

  const handleDeleteToken = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/users/${tokenUser?.id}/token`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        message.success('Token删除成功');
        setTokenUser(null);
        setTokenModalVisible(false);
        fetchUsers();
      } else {
        message.error('Token删除失败');
      }
    } catch (error) {
      console.error('Delete token error:', error);
      message.error('Token删除失败');
    }
  };

  const handleCreateUser = () => {
    setEditingUser(null);
    editForm.setFieldsValue({
      username: '',
      email: '',
      password: '',
      role: 'developer',
      status: 'active'
    });
    setEditModalVisible(true);
  };

  const handleCreateUserSubmit = async () => {
    try {
      const values = await editForm.validateFields();
      const token = localStorage.getItem('token');
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(values)
      });

      if (response.ok) {
        message.success('用户创建成功');
        setEditModalVisible(false);
        fetchUsers();
      } else {
        const errorData = await response.json();
        message.error(errorData.error || '创建失败');
      }
    } catch (error) {
      console.error('Create user error:', error);
      message.error('创建失败');
    }
  };

  const handlePasswordChange = (user: User) => {
    setPasswordUser(user);
    passwordForm.setFieldsValue({
      new_password: '',
      confirm_password: ''
    });
    setPasswordModalVisible(true);
  };

  const handlePasswordSubmit = async () => {
    try {
      const values = await passwordForm.validateFields();
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/users/${passwordUser?.id}/password`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          new_password: values.new_password
        })
      });

      if (response.ok) {
        message.success('密码设置成功');
        setPasswordModalVisible(false);
      } else {
        const errorData = await response.json();
        message.error(errorData.error || '密码设置失败');
      }
    } catch (error) {
      console.error('Set password error:', error);
      message.error('密码设置失败');
    }
  };

  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username'
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email'
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => {
        const colorMap: Record<string, string> = {
          admin: 'red',
          developer: 'blue',
          viewer: 'green'
        };
        return <Tag color={colorMap[role]}>{role}</Tag>;
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'red'}>
          {status === 'active' ? '活跃' : '停用'}
        </Tag>
      )
    },
    {
      title: 'Token状态',
      key: 'token_status',
      render: (_: any, record: User) => {
        if (!record.api_token) {
          return <Tag color="default">未设置</Tag>;
        }
        const isExpired = record.token_expires_at && new Date(record.token_expires_at) < new Date();
        return isExpired ? <Tag color="red">已过期</Tag> : <Tag color="green">有效</Tag>;
      }
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at'
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: User) => (
        <Space size="small">
          {(hasPermission('user_edit') || currentUser?.id === record.id) && (
            <Button
              type="link"
              icon={<KeyOutlined />}
              onClick={() => handleTokenManage(record)}
            >
              Token管理
            </Button>
          )}
          {(hasPermission('user_password') || currentUser?.id === record.id) && (
            <Button
              type="link"
              icon={<LockOutlined />}
              onClick={() => handlePasswordChange(record)}
            >
              设置密码
            </Button>
          )}
          {hasPermission('user_edit') && (
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
          )}
          {hasPermission('user_delete') && (
            <Popconfirm
              title="确认删除"
              description="确定要删除这个用户吗？"
              onConfirm={() => handleDelete(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button
                type="link"
                danger
                icon={<DeleteOutlined />}
              >
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  return (
    <>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>用户管理</h2>
        <Space>
          <Input
            placeholder="搜索用户"
            style={{ width: 200 }}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            onPressEnter={() => setPagination({ ...pagination, current: 1 })}
          />
          <Select
            placeholder="角色筛选"
            style={{ width: 120 }}
            allowClear
            onChange={(value) => {
              setFilters({ ...filters, role: value || '' });
              setPagination({ ...pagination, current: 1 });
            }}
          >
            <Select.Option value="admin">管理员</Select.Option>
            <Select.Option value="developer">开发者</Select.Option>
            <Select.Option value="viewer">查看者</Select.Option>
          </Select>
          <Select
            placeholder="状态筛选"
            style={{ width: 120 }}
            allowClear
            onChange={(value) => {
              setFilters({ ...filters, status: value || '' });
              setPagination({ ...pagination, current: 1 });
            }}
          >
            <Select.Option value="active">活跃</Select.Option>
            <Select.Option value="inactive">停用</Select.Option>
          </Select>
          {hasPermission('user_create') && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreateUser}
            >
              新增用户
            </Button>
          )}
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={users}
        rowKey="id"
        loading={loading}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          onChange: (page, pageSize) => {
            setPagination({ current: page, pageSize: pageSize || 10, total: pagination.total });
          }
        }}
      />
      </div>

      <Modal
        title={editingUser ? '编辑用户' : '新增用户'}
        open={editModalVisible}
        onOk={editingUser ? handleEditSubmit : handleCreateUserSubmit}
        onCancel={() => setEditModalVisible(false)}
        okText="保存"
        cancelText="取消"
      >
        <Form form={editForm} layout="vertical">
          {!editingUser && (
            <>
              <Form.Item
                label="用户名"
                name="username"
                rules={[{ required: true, message: '请输入用户名' }]}
              >
                <Input placeholder="请输入用户名" />
              </Form.Item>
              <Form.Item
                label="邮箱"
                name="email"
                rules={[
                  { required: true, message: '请输入邮箱' },
                  { type: 'email', message: '请输入有效的邮箱地址' }
                ]}
              >
                <Input placeholder="请输入邮箱" />
              </Form.Item>
              <Form.Item
                label="密码"
                name="password"
                rules={[{ required: true, message: '请输入密码' }]}
              >
                <Input.Password placeholder="请输入密码" />
              </Form.Item>
            </>
          )}
          {editingUser && (
            <Form.Item
              label="邮箱"
              name="email"
              rules={[
                { required: true, message: '请输入邮箱' },
                { type: 'email', message: '请输入有效的邮箱地址' }
              ]}
            >
              <Input placeholder="请输入邮箱" />
            </Form.Item>
          )}
          <Form.Item
            label="角色"
            name="role"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select>
              <Select.Option value="admin">管理员</Select.Option>
              <Select.Option value="developer">开发者</Select.Option>
              <Select.Option value="viewer">查看者</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            label="状态"
            name="status"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select>
              <Select.Option value="active">活跃</Select.Option>
              <Select.Option value="inactive">停用</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Token管理"
        open={tokenModalVisible}
        onCancel={() => setTokenModalVisible(false)}
        footer={null}
        width={600}
      >
        {tokenUser && (
          <div>
            <Card style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 12 }}>
                <Text strong>用户：</Text>
                <Text>{tokenUser.username}</Text>
              </div>
              <div style={{ marginBottom: 12 }}>
                <Text strong>Token状态：</Text>
                {!tokenUser.api_token ? (
                  <Tag color="default">未设置</Tag>
                ) : (
                  <Tag color={tokenUser.token_expires_at && new Date(tokenUser.token_expires_at) < new Date() ? 'red' : 'green'}>
                    {tokenUser.token_expires_at && new Date(tokenUser.token_expires_at) < new Date() ? '已过期' : '有效'}
                  </Tag>
                )}
              </div>
              {tokenUser.api_token && (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <Text strong>过期时间：</Text>
                    <Text>{tokenUser.token_expires_at ? dayjs(tokenUser.token_expires_at).format('YYYY-MM-DD HH:mm:ss') : '永久'}</Text>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <Text strong>权限范围：</Text>
                    <div>
                      {(() => {
                        if (!tokenUser.token_permissions) return <Tag color="blue">全部接口</Tag>;
                        
                        try {
                          const parsed = typeof tokenUser.token_permissions === 'string' 
                            ? JSON.parse(tokenUser.token_permissions) 
                            : tokenUser.token_permissions;
                          
                          if (parsed.type === 'categories') {
                            return (
                              <div>
                                {parsed.apis && parsed.apis.length > 0 && (
                                  <div>
                                    <Text type="secondary">授权接口：</Text>
                                    <div style={{ marginTop: 8, maxHeight: 200, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 4, padding: 8 }}>
                                      {parsed.apis.map((apiId: number) => {
                                        const api = publishedApis.find((a: any) => a.id === apiId);
                                        return api ? (
                                          <Tag key={apiId} color="green" style={{ marginBottom: 4 }}>
                                            {api.name}
                                          </Tag>
                                        ) : null;
                                      })}
                                    </div>
                                  </div>
                                )}
                                {(!parsed.apis || parsed.apis.length === 0) && (
                                  <Tag color="orange">未选择具体接口</Tag>
                                )}
                              </div>
                            );
                          } else if (parsed.type === 'read_only') {
                            return <Tag color="green">只读接口</Tag>;
                          } else {
                            return <Tag color="blue">全部接口</Tag>;
                          }
                        } catch (e) {
                          return <Tag color="blue">{tokenUser.token_permissions === 'all' ? '全部接口' : '自定义'}</Tag>;
                        }
                      })()}
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <Text strong>Token：</Text>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                      <Input.Password
                        value={tokenUser.api_token}
                        readOnly
                        style={{ flex: 1 }}
                      />
                      <Button
                        icon={<CopyOutlined />}
                        onClick={handleCopyToken}
                      >
                        复制
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </Card>

            <Card title="生成新Token">
              <Form form={tokenForm} layout="vertical">
                <Form.Item
                  label="有效期（天）"
                  name="expires_in_days"
                  rules={[{ required: true, message: '请输入有效期' }]}
                >
                  <Input type="number" placeholder="默认30天" />
                </Form.Item>
                <Form.Item
                  label="权限范围"
                  name="permissions"
                  rules={[{ required: true, message: '请选择权限范围' }]}
                  extra="必须勾选具体接口才能访问对应API"
                >
                  <Select onChange={(value) => {
                    if (value !== 'categories') {
                      setSelectedCategories([]);
                      setSelectedApis([]);
                    }
                  }}>
                    <Select.Option value="categories">按分类和接口选择</Select.Option>
                  </Select>
                </Form.Item>
                <Form.Item noStyle shouldUpdate={(prevValues, currentValues) => prevValues.permissions !== currentValues.permissions}>
                  {({ getFieldValue }) =>
                    getFieldValue('permissions') === 'categories' ? (
                      <>
                        <Form.Item label="选择分类">
                          <Select
                            mode="multiple"
                            placeholder="请选择可访问的接口分类"
                            value={selectedCategories}
                            onChange={(values) => {
                              setSelectedCategories(values);
                              setSelectedApis([]);
                            }}
                            style={{ width: '100%' }}
                            loading={categoriesLoading}
                          >
                            {categories.filter(cat => cat.status === 'active').map(cat => (
                              <Select.Option key={cat.code} value={cat.code}>
                                {cat.name}
                              </Select.Option>
                            ))}
                          </Select>
                        </Form.Item>
                        {selectedCategories.length > 0 && (
                          <Form.Item label="选择接口">
                            <div style={{ 
                              maxHeight: 350, 
                              overflowY: 'auto', 
                              border: '1px solid #d9d9d9', 
                              borderRadius: 4, 
                              padding: 12,
                              scrollbarWidth: 'thin',
                              scrollbarColor: '#888 #f1f1f1'
                            }}>
                              <style>{`
                                .api-select-scroll::-webkit-scrollbar {
                                  width: 8px;
                                }
                                .api-select-scroll::-webkit-scrollbar-track {
                                  background: #f1f1f1;
                                  border-radius: 4px;
                                }
                                .api-select-scroll::-webkit-scrollbar-thumb {
                                  background: #888;
                                  border-radius: 4px;
                                }
                                .api-select-scroll::-webkit-scrollbar-thumb:hover {
                                  background: #555;
                                }
                              `}</style>
                              {selectedCategories.map(category => {
                                const apis = categoryApis[category] || [];
                                if (apis.length === 0) return null;
                                
                                const categoryObj = categories.find(cat => cat.code === category);
                                const categoryName = categoryObj ? categoryObj.name : category;
                                
                                return (
                                  <div key={category} style={{ marginBottom: 16 }}>
                                    <div style={{ fontWeight: 'bold', marginBottom: 8, color: '#1890ff' }}>
                                      {categoryName}
                                    </div>
                                    <Checkbox.Group
                                      value={selectedApis}
                                      onChange={(checkedValues) => setSelectedApis(checkedValues as number[])}
                                      style={{ width: '100%' }}
                                    >
                                      <Space direction="vertical" style={{ width: '100%' }} size="small">
                                        {apis.map((api: any) => (
                                          <Checkbox key={api.id} value={api.id}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                              <span style={{ fontWeight: 500 }}>{api.name}</span>
                                              <span style={{ color: '#999', fontSize: 12 }}>({api.path})</span>
                                            </div>
                                          </Checkbox>
                                        ))}
                                      </Space>
                                    </Checkbox.Group>
                                  </div>
                                );
                              })}
                            </div>
                          </Form.Item>
                        )}
                      </>
                    ) : null
                  }
                </Form.Item>
                <Form.Item>
                  <Space>
                    <Button
                      type="primary"
                      icon={<ReloadOutlined />}
                      onClick={handleGenerateToken}
                    >
                      生成Token
                    </Button>
                    {tokenUser.api_token && (
                      <Popconfirm
                        title="确认删除"
                        description="确定要删除当前Token吗？"
                        onConfirm={handleDeleteToken}
                        okText="确定"
                        cancelText="取消"
                      >
                        <Button danger>
                          删除Token
                        </Button>
                      </Popconfirm>
                    )}
                  </Space>
                </Form.Item>
              </Form>
            </Card>
          </div>
        )}
      </Modal>

      <Modal
        title="设置密码"
        open={passwordModalVisible}
        onOk={handlePasswordSubmit}
        onCancel={() => setPasswordModalVisible(false)}
        okText="保存"
        cancelText="取消"
      >
        {passwordUser && (
          <div style={{ marginBottom: 16 }}>
            <Text strong>用户：</Text>
            <Text>{passwordUser.username}</Text>
          </div>
        )}
        <Form form={passwordForm} layout="vertical">
          <Form.Item
            label="新密码"
            name="new_password"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码至少6个字符' }
            ]}
          >
            <Input.Password placeholder="请输入新密码" />
          </Form.Item>
          <Form.Item
            label="确认新密码"
            name="confirm_password"
            dependencies={['new_password']}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                }
              })
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
  </>
  );
};

export default UserList;
