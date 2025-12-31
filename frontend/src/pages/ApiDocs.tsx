import React, { useEffect, useState } from 'react';
import { Card, Tag, Button, message, Space, Empty, Typography, Divider, Alert, Input } from 'antd';
import { ShareAltOutlined, CopyOutlined, ApiOutlined, LockOutlined, UnlockOutlined, CheckCircleOutlined, SearchOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';

const { Title, Paragraph, Text } = Typography;

interface ApiParameter {
  id: number;
  param_name: string;
  param_type: string;
  data_type: string;
  required: number;
  default_value: string;
  description: string;
}

interface Api {
  id: number;
  name: string;
  path: string;
  method: string;
  description: string;
  datasource_name: string;
  category: string;
  require_auth: number;
  parameters: ApiParameter[];
}

interface ApiResponse {
  categories: Record<string, Api[]>;
  apis: Api[];
}

const ApiDocs: React.FC = () => {
  const { apiId } = useParams<{ apiId?: string }>();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Record<string, Api[]>>({});
  const [selectedApi, setSelectedApi] = useState<Api | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredCategories, setFilteredCategories] = useState<Record<string, Api[]>>({});

  useEffect(() => {
    if (apiId) {
      fetchApiDetail(parseInt(apiId));
    } else {
      fetchPublishedApis();
    }
  }, [apiId]);

  useEffect(() => {
    if (!searchTerm) {
      setFilteredCategories(categories);
      return;
    }
    
    const term = searchTerm.toLowerCase();
    const filtered: Record<string, Api[]> = {};
    
    Object.entries(categories).forEach(([category, apis]) => {
      const filteredApis = apis.filter(api => 
        api.name.toLowerCase().includes(term) || 
        api.path.toLowerCase().includes(term) ||
        (api.description && api.description.toLowerCase().includes(term))
      );
      
      if (filteredApis.length > 0) {
        filtered[category] = filteredApis;
      }
    });
    
    setFilteredCategories(filtered);
  }, [searchTerm, categories]);

  const fetchPublishedApis = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/docs/published');
      if (response.ok) {
        const data: ApiResponse = await response.json();
        setCategories(data.categories);
        setFilteredCategories(data.categories);
      }
    } catch (error) {
      console.error('Failed to fetch APIs:', error);
      message.error('获取接口列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchApiDetail = async (id: number) => {
    setLoading(true);
    setSelectedApi(null);
    try {
      const response = await fetch(`/api/docs/${id}`);
      if (response.ok) {
        const api: Api = await response.json();
        setSelectedApi(api);
        setCategories({ [api.category]: [api] });
      } else if (response.status === 404) {
        message.error('接口不存在或未发布');
      } else {
        const error = await response.json();
        message.error(error.error || '获取接口详情失败');
      }
    } catch (error) {
      console.error('Failed to fetch API detail:', error);
      message.error('获取接口详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      message.success('链接已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      message.error('复制失败');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success('已复制');
  };

  const renderAuthSection = (api: Api) => {
    if (api.require_auth) {
      return (
        <Alert
          message="需要认证"
          description="此接口需要使用 API Token 进行认证"
          type="info"
          icon={<LockOutlined />}
          showIcon
          style={{ marginBottom: 16 }}
        />
      );
    }
    return (
      <Alert
        message="公开接口"
        description="此接口无需认证即可访问"
        type="success"
        icon={<UnlockOutlined />}
        showIcon
        style={{ marginBottom: 16 }}
      />
    );
  };

  const renderAuthExample = (api: Api) => {
    if (!api.require_auth) return null;

    return (
      <div style={{ marginTop: 16 }}>
        <Title level={5}>认证方式</Title>
        <Paragraph>
          在请求头中添加 Authorization 字段，值为您的 API Token：
        </Paragraph>
        <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, marginBottom: 8 }}>
          <Text code>Authorization: Bearer YOUR_API_TOKEN</Text>
        </div>
        <Button
          size="small"
          icon={<CopyOutlined />}
          onClick={() => copyToClipboard('Authorization: Bearer YOUR_API_TOKEN')}
        >
          复制
        </Button>
      </div>
    );
  };

  const renderRequestExample = (api: Api) => {
    const baseUrl = window.location.origin;
    const url = `${baseUrl}${api.path}`;
    const authHeader = api.require_auth ? `\n  'Authorization': 'Bearer YOUR_API_TOKEN',` : '';

    return (
      <div style={{ marginTop: 16 }}>
        <Title level={5}>请求示例</Title>
        <Paragraph>
          使用 curl 调用接口：
        </Paragraph>
        <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, marginBottom: 8 }}>
          <Text code>
            curl -X {api.method} '{url}' \{authHeader}
            <br />
            {'  -H "Content-Type: application/json"'}
          </Text>
        </div>
        <Button
          size="small"
          icon={<CopyOutlined />}
          onClick={() => copyToClipboard(`curl -X ${api.method} '${url}' ${api.require_auth ? "-H 'Authorization: Bearer YOUR_API_TOKEN'" : ''} -H 'Content-Type: application/json'`)}
        >
          复制
        </Button>
      </div>
    );
  };

  const renderResponseExample = () => {
    return (
      <div style={{ marginTop: 16 }}>
        <Title level={5}>响应示例</Title>
        <Paragraph>
          成功响应：
        </Paragraph>
        <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, marginBottom: 8 }}>
          <Text code>
            {'{'}
            <br />
            {'  "code": 200,'}
            <br />
            {'  "message": "success",'}
            <br />
            {'  "data": {'}
            <br />
            {'    // 您的数据'}
            <br />
            {'  }'}
            <br />
            {'}'}
          </Text>
        </div>
        <Button
          size="small"
          icon={<CopyOutlined />}
          onClick={() => copyToClipboard('{"code": 200,"message": "success","data": {}}')}
        >
          复制
        </Button>
      </div>
    );
  };

  const renderParameters = (api: Api) => {
    if (!api.parameters || api.parameters.length === 0) {
      return <Paragraph>此接口无需参数</Paragraph>;
    }

    return (
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
            <th style={{ padding: 8, textAlign: 'left' }}>参数名</th>
            <th style={{ padding: 8, textAlign: 'left' }}>类型</th>
            <th style={{ padding: 8, textAlign: 'left' }}>位置</th>
            <th style={{ padding: 8, textAlign: 'left' }}>必填</th>
            <th style={{ padding: 8, textAlign: 'left' }}>默认值</th>
            <th style={{ padding: 8, textAlign: 'left' }}>说明</th>
          </tr>
        </thead>
        <tbody>
          {api.parameters.map((param) => (
            <tr key={param.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: 8 }}><Text code>{param.param_name}</Text></td>
              <td style={{ padding: 8 }}><Tag color="blue">{param.data_type}</Tag></td>
              <td style={{ padding: 8 }}><Tag>{param.param_type}</Tag></td>
              <td style={{ padding: 8 }}>
                {param.required ? (
                  <Tag color="red">必填</Tag>
                ) : (
                  <Tag>可选</Tag>
                )}
              </td>
              <td style={{ padding: 8 }}>{param.default_value || '-'}</td>
              <td style={{ padding: 8 }}>{param.description || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const renderApiCard = (api: Api) => {
    const methodColor: Record<string, string> = {
      GET: 'green',
      POST: 'blue',
      PUT: 'orange',
      DELETE: 'red'
    };

    return (
      <Card
        key={api.id}
        style={{ marginBottom: 16 }}
        title={
          <Space>
            <Tag color={methodColor[api.method]}>{api.method}</Tag>
            <Text strong>{api.name}</Text>
            {api.require_auth ? <LockOutlined style={{ color: '#1890ff' }} /> : <UnlockOutlined style={{ color: '#52c41a' }} />}
          </Space>
        }
        extra={
          <Button
            type="primary"
            size="small"
            icon={<ApiOutlined />}
            onClick={() => navigate(`/docs/${api.id}`)}
          >
            查看详情
          </Button>
        }
      >
        <Paragraph ellipsis={{ rows: 2 }}>{api.description || '暂无描述'}</Paragraph>
        <Space>
          <Text type="secondary">{api.path}</Text>
          <Tag>{api.category}</Tag>
        </Space>
      </Card>
    );
  };

  if (selectedApi) {
    const methodColor: Record<string, string> = {
      GET: 'green',
      POST: 'blue',
      PUT: 'orange',
      DELETE: 'red'
    };

    return (
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <Space>
            <Button onClick={() => navigate('/docs')}>返回列表</Button>
            <Title level={2} style={{ margin: 0 }}>接口文档</Title>
          </Space>
          <Button
            type="primary"
            icon={copied ? <CheckCircleOutlined /> : <ShareAltOutlined />}
            onClick={handleShare}
          >
            {copied ? '已复制' : '分享链接'}
          </Button>
        </div>

        <Card>
          <Space style={{ marginBottom: 16 }}>
            <Tag color={methodColor[selectedApi.method]} style={{ fontSize: 16 }}>{selectedApi.method}</Tag>
            <Title level={3} style={{ margin: 0 }}>{selectedApi.name}</Title>
            {selectedApi.require_auth ? <LockOutlined style={{ color: '#1890ff', fontSize: 20 }} /> : <UnlockOutlined style={{ color: '#52c41a', fontSize: 20 }} />}
          </Space>
          
          <Divider />
          
          <Paragraph>{selectedApi.description || '暂无描述'}</Paragraph>
          
          <div style={{ marginBottom: 16 }}>
            <Text strong>接口路径：</Text>
            <Text code>{selectedApi.path}</Text>
          </div>
          
          <div style={{ marginBottom: 16 }}>
            <Text strong>分类：</Text>
            <Tag>{selectedApi.category}</Tag>
          </div>
          
          <div style={{ marginBottom: 16 }}>
            <Text strong>数据源：</Text>
            <Text>{selectedApi.datasource_name}</Text>
          </div>

          {renderAuthSection(selectedApi)}

          <Title level={4}>接口参数</Title>
          {renderParameters(selectedApi)}

          {renderAuthExample(selectedApi)}

          {renderRequestExample(selectedApi)}

          {renderResponseExample()}
        </Card>
      </div>
    );
  }

  if (apiId && loading) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <Space>
            <Button onClick={() => navigate('/docs')}>返回列表</Button>
            <Title level={2} style={{ margin: 0 }}>接口文档</Title>
          </Space>
        </div>
        <Card>
          <div style={{ textAlign: 'center', padding: 40 }}>加载中...</div>
        </Card>
      </div>
    );
  }

  if (apiId && !loading) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <Space>
            <Button onClick={() => navigate('/docs')}>返回列表</Button>
            <Title level={2} style={{ margin: 0 }}>接口文档</Title>
          </Space>
        </div>
        <Card>
          <Empty description="接口不存在或未发布" />
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2}>接口文档</Title>
        <Space>
          <Input
            placeholder="搜索接口..."
            prefix={<SearchOutlined />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: 200 }}
            allowClear
          />
          <Button
            type="primary"
            icon={copied ? <CheckCircleOutlined /> : <ShareAltOutlined />}
            onClick={handleShare}
          >
            {copied ? '已复制' : '分享链接'}
          </Button>
        </Space>
      </div>

      <Card>
        <Alert
          message="公开文档"
          description="此页面为公开接口文档，无需登录即可访问。您可以分享此链接给第三方查看已发布的接口。"
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>加载中...</div>
        ) : Object.keys(filteredCategories).length === 0 ? (
          <Empty description={searchTerm ? '未找到匹配的接口' : '暂无已发布的接口'} />
        ) : (
          Object.entries(filteredCategories).map(([category, categoryApis]) => (
            <div key={category} style={{ marginBottom: 24 }}>
              <Title level={3}>{category}</Title>
              {categoryApis.map(renderApiCard)}
            </div>
          ))
        )}
      </Card>
    </div>
  );
};

export default ApiDocs;
