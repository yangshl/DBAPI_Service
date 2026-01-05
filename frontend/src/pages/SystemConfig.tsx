import React, { useEffect, useState } from 'react';
import { Tabs, Table, Button, Space, Tag, Modal, message, Input, Form, Card, Popconfirm, Switch, Select } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';

const { TabPane } = Tabs;

interface ApiCategory {
  id: number;
  name: string;
  code: string;
  description: string;
  sort_order: number;
  status: string;
  created_at: string;
  updated_at: string;
}

interface IpWhitelist {
  id: number;
  ip_address: string;
  description: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

const SystemConfig: React.FC = () => {
  const [activeTab, setActiveTab] = useState('categories');
  
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ApiCategory | null>(null);
  const [categoryForm] = Form.useForm();

  const [whitelist, setWhitelist] = useState<IpWhitelist[]>([]);
  const [whitelistLoading, setWhitelistLoading] = useState(false);
  const [whitelistModalVisible, setWhitelistModalVisible] = useState(false);
  const [editingWhitelist, setEditingWhitelist] = useState<IpWhitelist | null>(null);
  const [whitelistForm] = Form.useForm();

  const [settings, setSettings] = useState<Record<string, string>>({});
  const [settingsLoading, setSettingsLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'categories') {
      fetchCategories();
    } else if (activeTab === 'whitelist') {
      fetchWhitelist();
    } else if (activeTab === 'settings') {
      fetchSettings();
    }
  }, [activeTab]);

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
      message.error('获取API分类失败');
    } finally {
      setCategoriesLoading(false);
    }
  };

  const fetchWhitelist = async () => {
    setWhitelistLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/system/whitelist', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setWhitelist(data);
      }
    } catch (error) {
      console.error('Failed to fetch whitelist:', error);
      message.error('获取IP白名单失败');
    } finally {
      setWhitelistLoading(false);
    }
  };

  const fetchSettings = async () => {
    setSettingsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/system/settings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      message.error('获取系统设置失败');
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleCreateCategory = () => {
    setEditingCategory(null);
    categoryForm.setFieldsValue({
      name: '',
      code: '',
      description: '',
      sort_order: 0,
      status: 'active'
    });
    setCategoryModalVisible(true);
  };

  const handleEditCategory = (category: ApiCategory) => {
    setEditingCategory(category);
    categoryForm.setFieldsValue({
      name: category.name,
      code: category.code,
      description: category.description,
      sort_order: category.sort_order,
      status: category.status
    });
    setCategoryModalVisible(true);
  };

  const handleDeleteCategory = async (id: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/system/categories/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        message.success('删除成功');
        fetchCategories();
      } else {
        const errorData = await response.json();
        message.error(errorData.error || '删除失败');
      }
    } catch (error) {
      console.error('Delete category error:', error);
      message.error('删除失败');
    }
  };

  const handleCategorySubmit = async () => {
    try {
      const values = await categoryForm.validateFields();
      const token = localStorage.getItem('token');
      
      let response;
      if (editingCategory) {
        response = await fetch(`/api/system/categories/${editingCategory.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(values)
        });
      } else {
        response = await fetch('/api/system/categories', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(values)
        });
      }

      if (response.ok) {
        message.success(editingCategory ? '更新成功' : '创建成功');
        setCategoryModalVisible(false);
        fetchCategories();
      } else {
        const errorData = await response.json();
        message.error(errorData.error || '操作失败');
      }
    } catch (error) {
      console.error('Category submit error:', error);
      message.error('操作失败');
    }
  };

  const handleCreateWhitelist = () => {
    setEditingWhitelist(null);
    whitelistForm.setFieldsValue({
      ip_address: '',
      description: '',
      enabled: true
    });
    setWhitelistModalVisible(true);
  };

  const handleEditWhitelist = (item: IpWhitelist) => {
    setEditingWhitelist(item);
    whitelistForm.setFieldsValue({
      ip_address: item.ip_address,
      description: item.description,
      enabled: item.enabled === 1
    });
    setWhitelistModalVisible(true);
  };

  const handleDeleteWhitelist = async (id: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/system/whitelist/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        message.success('删除成功');
        fetchWhitelist();
      } else {
        message.error('删除失败');
      }
    } catch (error) {
      console.error('Delete whitelist error:', error);
      message.error('删除失败');
    }
  };

  const handleWhitelistSubmit = async () => {
    try {
      const values = await whitelistForm.validateFields();
      const token = localStorage.getItem('token');
      
      let response;
      if (editingWhitelist) {
        response = await fetch(`/api/system/whitelist/${editingWhitelist.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(values)
        });
      } else {
        response = await fetch('/api/system/whitelist', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(values)
        });
      }

      if (response.ok) {
        message.success(editingWhitelist ? '更新成功' : '创建成功');
        setWhitelistModalVisible(false);
        fetchWhitelist();
      } else {
        const errorData = await response.json();
        message.error(errorData.error || '操作失败');
      }
    } catch (error) {
      console.error('Whitelist submit error:', error);
      message.error('操作失败');
    }
  };

  const handleToggleWhitelist = async (id: number, enabled: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/system/whitelist/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ enabled: enabled === 1 ? 0 : 1 })
      });

      if (response.ok) {
        message.success('状态更新成功');
        fetchWhitelist();
      } else {
        message.error('状态更新失败');
      }
    } catch (error) {
      console.error('Toggle whitelist error:', error);
      message.error('状态更新失败');
    }
  };

  const handleUpdateSetting = async (key: string, value: string) => {
    try {
      if (key === 'server_ip') {
        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$|^0\.0\.0\.0$/;
        if (!ipRegex.test(value)) {
          message.error('请输入有效的IP地址格式，例如：192.168.1.1 或 0.0.0.0');
          return;
        }
        
        const parts = value.split('.');
        if (parts.length === 4) {
          for (const part of parts) {
            const num = parseInt(part, 10);
            if (num < 0 || num > 255) {
              message.error('IP地址的每个部分必须在0-255之间');
              return;
            }
          }
        }
      }

      if (key === 'server_port') {
        const port = parseInt(value, 10);
        if (isNaN(port) || port < 1 || port > 65535) {
          message.error('端口号必须在1-65535之间');
          return;
        }
      }

      if (key === 'server_domain') {
        if (value) {
          const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
          if (!domainRegex.test(value)) {
            message.error('请输入有效的域名格式，例如：example.com 或 api.example.com');
            return;
          }
        }
      }

      if (key === 'timezone_offset') {
        const offset = parseInt(value, 10);
        if (isNaN(offset) || offset < -12 || offset > 14) {
          message.error('时区偏移必须在-12到14之间');
          return;
        }
      }

      const token = localStorage.getItem('token');
      const response = await fetch(`/api/system/settings/${key}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ value })
      });

      if (response.ok) {
        message.success('设置更新成功，请重启后端服务以使更改生效');
        fetchSettings();
      } else {
        message.error('设置更新失败');
      }
    } catch (error) {
      console.error('Update setting error:', error);
      message.error('设置更新失败');
    }
  };

  const categoryColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: '代码',
      dataIndex: 'code',
      key: 'code'
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description'
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      key: 'sort_order'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'red'}>
          {status === 'active' ? '启用' : '停用'}
        </Tag>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at'
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: ApiCategory) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEditCategory(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description="确定要删除这个分类吗？"
            onConfirm={() => handleDeleteCategory(record.id)}
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
        </Space>
      )
    }
  ];

  const whitelistColumns = [
    {
      title: 'IP地址',
      dataIndex: 'ip_address',
      key: 'ip_address'
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description'
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: number, record: IpWhitelist) => (
        <Switch
          checked={enabled === 1}
          onChange={() => handleToggleWhitelist(record.id, enabled)}
          checkedChildren="启用"
          unCheckedChildren="停用"
        />
      )
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at'
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: IpWhitelist) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEditWhitelist(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description="确定要删除这个白名单项吗？"
            onConfirm={() => handleDeleteWhitelist(record.id)}
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
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>系统配置</h2>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="API分类管理" key="categories">
          <div style={{ marginBottom: 16 }}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreateCategory}
            >
              新增分类
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchCategories}
              style={{ marginLeft: 8 }}
            >
              刷新
            </Button>
          </div>
          <Table
            columns={categoryColumns}
            dataSource={categories}
            rowKey="id"
            loading={categoriesLoading}
            pagination={false}
          />
        </TabPane>

        <TabPane tab="IP白名单管理" key="whitelist">
          <div style={{ marginBottom: 16 }}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreateWhitelist}
            >
              新增白名单
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchWhitelist}
              style={{ marginLeft: 8 }}
            >
              刷新
            </Button>
          </div>
          <Table
            columns={whitelistColumns}
            dataSource={whitelist}
            rowKey="id"
            loading={whitelistLoading}
            pagination={false}
          />
        </TabPane>

        <TabPane tab="系统设置" key="settings">
          <Card loading={settingsLoading}>
            <Form layout="vertical">
              <Form.Item 
                label="服务器监听IP地址"
                extra="设置服务器监听的IP地址，0.0.0.0表示监听所有网卡，修改后需要重启后端服务"
              >
                <Input
                  value={settings.server_ip || '0.0.0.0'}
                  onChange={(e) => handleUpdateSetting('server_ip', e.target.value)}
                  placeholder="请输入IP地址，例如：0.0.0.0 或 192.168.1.100"
                />
              </Form.Item>
              <Form.Item 
                label="服务器监听端口"
                extra="设置服务器监听的端口号，修改后需要重启后端服务"
              >
                <Input
                  type="number"
                  value={settings.server_port || '3000'}
                  onChange={(e) => handleUpdateSetting('server_port', e.target.value)}
                  placeholder="请输入端口号，例如：3000"
                />
              </Form.Item>
              <Form.Item 
                label="服务器监听域名"
                extra="设置服务器监听的域名，留空则不限制域名，修改后需要重启后端服务"
              >
                <Input
                  value={settings.server_domain || ''}
                  onChange={(e) => handleUpdateSetting('server_domain', e.target.value)}
                  placeholder="请输入域名，例如：example.com 或 api.example.com"
                />
              </Form.Item>
              <Form.Item label="IP白名单是否启用">
                <Switch
                  checked={settings.ip_whitelist_enabled === 'true'}
                  onChange={(checked) => handleUpdateSetting('ip_whitelist_enabled', checked.toString())}
                  checkedChildren="启用"
                  unCheckedChildren="停用"
                />
              </Form.Item>
              <Form.Item 
                label="时区偏移（小时）"
                extra="设置时区偏移小时数，例如：北京时间为8，纽约为-5，修改后需要重启后端服务"
              >
                <Input
                  type="number"
                  value={settings.timezone_offset || '8'}
                  onChange={(e) => handleUpdateSetting('timezone_offset', e.target.value)}
                  placeholder="请输入时区偏移，例如：8"
                />
              </Form.Item>
            </Form>
          </Card>
        </TabPane>
      </Tabs>

      <Modal
        title={editingCategory ? '编辑API分类' : '新增API分类'}
        open={categoryModalVisible}
        onOk={handleCategorySubmit}
        onCancel={() => setCategoryModalVisible(false)}
        okText="保存"
        cancelText="取消"
      >
        <Form form={categoryForm} layout="vertical">
          <Form.Item
            label="分类名称"
            name="name"
            rules={[{ required: true, message: '请输入分类名称' }]}
          >
            <Input placeholder="请输入分类名称" />
          </Form.Item>
          <Form.Item
            label="分类代码"
            name="code"
            rules={[{ required: true, message: '请输入分类代码' }]}
          >
            <Input placeholder="请输入分类代码（英文）" />
          </Form.Item>
          <Form.Item
            label="描述"
            name="description"
          >
            <Input.TextArea placeholder="请输入描述" rows={3} />
          </Form.Item>
          <Form.Item
            label="排序"
            name="sort_order"
          >
            <Input type="number" placeholder="请输入排序号" />
          </Form.Item>
          <Form.Item
            label="状态"
            name="status"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select>
              <Select.Option value="active">启用</Select.Option>
              <Select.Option value="inactive">停用</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingWhitelist ? '编辑IP白名单' : '新增IP白名单'}
        open={whitelistModalVisible}
        onOk={handleWhitelistSubmit}
        onCancel={() => setWhitelistModalVisible(false)}
        okText="保存"
        cancelText="取消"
      >
        <Form form={whitelistForm} layout="vertical">
          <Form.Item
            label="IP地址"
            name="ip_address"
            rules={[
              { required: true, message: '请输入IP地址' },
              { pattern: /^(\d{1,3}\.){3}\d{1,3}$/, message: '请输入有效的IP地址' }
            ]}
          >
            <Input placeholder="请输入IP地址，例如：192.168.1.1" />
          </Form.Item>
          <Form.Item
            label="描述"
            name="description"
          >
            <Input.TextArea placeholder="请输入描述" rows={3} />
          </Form.Item>
          <Form.Item
            label="状态"
            name="enabled"
            valuePropName="checked"
          >
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SystemConfig;
