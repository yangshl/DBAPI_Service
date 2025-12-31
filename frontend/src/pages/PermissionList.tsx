import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Space,
  Tag,
  message,
  Card,
  Tree,
  Row,
  Col,
  Popconfirm
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SaveOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import type { TreeDataNode, TreeProps } from 'antd';
import { usePermissions } from '../contexts/PermissionContext';

const { Option } = Select;

interface Permission {
  id: number;
  code: string;
  name: string;
  type: 'menu' | 'button';
  resource: string;
  action?: string;
  parent_id?: number | null;
  path?: string;
  icon?: string;
  sort_order: number;
  description?: string;
  status: 'active' | 'inactive';
  roles: string[];
  children?: Permission[];
}

const PermissionList: React.FC = () => {
  const { hasPermission } = usePermissions();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPermission, setEditingPermission] = useState<Permission | null>(null);
  const [form] = Form.useForm();
  const [roleAssignModalVisible, setRoleAssignModalVisible] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('admin');
  const [checkedPermissions, setCheckedPermissions] = useState<React.Key[]>([]);

  const fetchPermissions = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/permissions', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setPermissions(data.data);
    } catch (error) {
      message.error('获取权限列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchRolePermissions = async (role: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/permissions/role/${role}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      const permIds = data.data.map((p: Permission) => p.id);
      setCheckedPermissions(permIds);
    } catch (error) {
      message.error('获取角色权限失败');
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, []);

  useEffect(() => {
    if (roleAssignModalVisible) {
      fetchRolePermissions(selectedRole);
    }
  }, [roleAssignModalVisible, selectedRole]);

  const handleAdd = () => {
    setEditingPermission(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (permission: Permission) => {
    setEditingPermission(permission);
    form.setFieldsValue(permission);
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/permissions/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        message.success('删除成功');
        fetchPermissions();
      } else {
        message.error('删除失败');
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      const token = localStorage.getItem('token');
      const url = editingPermission
        ? `/api/permissions/${editingPermission.id}`
        : '/api/permissions';
      const method = editingPermission ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(values)
      });

      if (response.ok) {
        message.success(editingPermission ? '更新成功' : '创建成功');
        setModalVisible(false);
        form.resetFields();
        fetchPermissions();
      } else {
        message.error(editingPermission ? '更新失败' : '创建失败');
      }
    } catch (error) {
      message.error(editingPermission ? '更新失败' : '创建失败');
    }
  };

  const handleAssignPermissions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/permissions/assign-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          role: selectedRole,
          permission_ids: checkedPermissions
        })
      });

      if (response.ok) {
        message.success('权限分配成功');
        setRoleAssignModalVisible(false);
      } else {
        message.error('权限分配失败');
      }
    } catch (error) {
      message.error('权限分配失败');
    }
  };

  const buildTreeData = (permissions: Permission[]): TreeDataNode[] => {
    const map = new Map<number, TreeDataNode>();
    const roots: TreeDataNode[] = [];

    permissions.forEach(perm => {
      map.set(perm.id, {
        key: perm.id,
        title: `${perm.name} (${perm.code})`,
        children: []
      });
    });

    permissions.forEach(perm => {
      const node = map.get(perm.id);
      if (perm.parent_id && map.has(perm.parent_id)) {
        map.get(perm.parent_id)!.children!.push(node!);
      } else {
        roots.push(node!);
      }
    });

    return roots;
  };

  const onCheck: TreeProps['onCheck'] = (checkedKeys) => {
    setCheckedPermissions(checkedKeys as React.Key[]);
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80
    },
    {
      title: '权限编码',
      dataIndex: 'code',
      key: 'code'
    },
    {
      title: '权限名称',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <Tag color={type === 'menu' ? 'blue' : 'green'}>
          {type === 'menu' ? '菜单' : '按钮'}
        </Tag>
      )
    },
    {
      title: '资源',
      dataIndex: 'resource',
      key: 'resource'
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      render: (action: string) => action || '-'
    },
    {
      title: '路径',
      dataIndex: 'path',
      key: 'path',
      render: (path: string) => path || '-'
    },
    {
      title: '角色',
      dataIndex: 'roles',
      key: 'roles',
      render: (roles: string[]) => (
        <>
          {roles.map(role => (
            <Tag key={role} color={role === 'admin' ? 'red' : role === 'developer' ? 'blue' : 'default'}>
              {role}
            </Tag>
          ))}
        </>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'red'}>
          {status === 'active' ? '启用' : '禁用'}
        </Tag>
      )
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 80
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: Permission) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            size="small"
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          {hasPermission('permission_edit') && (
            <Popconfirm
              title="确认删除"
              description="确定要删除这个权限吗？"
              onConfirm={() => handleDelete(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button
                type="link"
                danger
                icon={<DeleteOutlined />}
                size="small"
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
    <div>
      <Card
        title="权限管理"
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchPermissions}
            >
              刷新
            </Button>
            {hasPermission('permission_edit') && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAdd}
              >
                新增权限
              </Button>
            )}
            {hasPermission('permission_edit') && (
              <Button
                icon={<SaveOutlined />}
                onClick={() => {
                  setSelectedRole('admin');
                  setRoleAssignModalVisible(true);
                }}
              >
                角色权限配置
              </Button>
            )}
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={permissions}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`
          }}
        />
      </Card>

      <Modal
        title={editingPermission ? '编辑权限' : '新增权限'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="权限编码"
                name="code"
                rules={[{ required: true, message: '请输入权限编码' }]}
              >
                <Input placeholder="如: api_create" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="权限名称"
                name="name"
                rules={[{ required: true, message: '请输入权限名称' }]}
              >
                <Input placeholder="如: 创建API" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="权限类型"
                name="type"
                rules={[{ required: true, message: '请选择权限类型' }]}
              >
                <Select placeholder="请选择">
                  <Option value="menu">菜单</Option>
                  <Option value="button">按钮</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="资源"
                name="resource"
                rules={[{ required: true, message: '请输入资源' }]}
              >
                <Input placeholder="如: api" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="操作"
                name="action"
              >
                <Input placeholder="如: create, edit, delete" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="路径"
                name="path"
              >
                <Input placeholder="如: /apis" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="图标"
                name="icon"
              >
                <Input placeholder="如: ApiOutlined" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="排序"
                name="sort_order"
                initialValue={0}
              >
                <Input type="number" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="描述"
            name="description"
          >
            <Input.TextArea rows={3} placeholder="权限描述" />
          </Form.Item>

          <Form.Item
            label="状态"
            name="status"
            initialValue="active"
            valuePropName="checked"
          >
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>

          <Form.Item
            label="角色"
            name="roles"
          >
            <Select mode="multiple" placeholder="选择角色">
              <Option value="admin">管理员</Option>
              <Option value="developer">开发者</Option>
              <Option value="viewer">查看者</Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setModalVisible(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="角色权限配置"
        open={roleAssignModalVisible}
        onCancel={() => setRoleAssignModalVisible(false)}
        onOk={handleAssignPermissions}
        width={600}
      >
        <Form layout="vertical">
          <Form.Item label="选择角色">
            <Select
              value={selectedRole}
              onChange={(value) => {
                setSelectedRole(value);
                fetchRolePermissions(value);
              }}
            >
              <Option value="admin">管理员</Option>
              <Option value="developer">开发者</Option>
              <Option value="viewer">查看者</Option>
            </Select>
          </Form.Item>

          <Form.Item label="权限列表">
            <Tree
              checkable
              checkedKeys={checkedPermissions}
              onCheck={onCheck}
              treeData={buildTreeData(permissions)}
              defaultExpandAll
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PermissionList;
