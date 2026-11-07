"""Beverage discovery must query relevant map categories, not unrelated trades."""
import httpx
import pytest

from harvey.collectors.discover import DiscoveryQuery, OpenStreetMap


@pytest.mark.asyncio
@pytest.mark.parametrize("term,expected", [
    ("beverage shop", ("shop=beverages", "shop=alcohol")),
    ("wine shop", ("shop=wine", "shop=alcohol")),
    ("liquor store", ("shop=alcohol",)),
    ("cocktail bar", ("amenity=bar",)),
    ("nightclub", ("amenity=nightclub",)),
    ("lounge", ("amenity=bar",)),
])
async def test_abuja_beverage_discovery_queries_matching_categories(term, expected):
    async def respond(request):
        query = request.content.decode()
        for tag in expected:
            assert f"[{tag}]" in query
        assert "around:35000,9.0765,7.3986" in query
        assert "office=company" not in query
        return httpx.Response(200, json={"elements": [{
            "type": "node", "id": 123,
            "tags": {"name": "Example Beverage Business"},
        }]})

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        results = await OpenStreetMap().fetch(client, None, DiscoveryQuery(
            term=term, location="Abuja, Nigeria", coordinate="9.0765,7.3986,35"))
    assert len(results) == 1
    assert results[0].name == "Example Beverage Business"
